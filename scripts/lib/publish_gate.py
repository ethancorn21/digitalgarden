#!/usr/bin/env python3
"""publish_gate.py - decide what leaves the Mac, and scrub it on the way out.

Two rules, applied to the vault before anything is uploaded:

1. Status gate. A note in "2 - atomic notes" is published only when its header
   block carries `status: #adult`. #baby, empty status, no status: withheld.
   Default deny.

2. Link scrub. Links to vault notes that are NOT published are hidden in every
   published markdown note, by how the link sits in its line:
     - a pointer (a line of only links, "label: [[x]]", "see [[x]]", "(see
       [[x]])", or a link left standing after a finished sentence) is removed;
       a line left with nothing is dropped, and so is a section left empty;
     - a link that is a word in a sentence is unlinked: the sentence stays and
       the link shows as plain text (its alias if it had one);
     - embeds of unpublished files are removed.
   Links to notes that do not exist at all are left alone.

The header is matched as raw text on purpose: vault notes have no opening `---`
(and some no closing one), so no frontmatter parser sees it, and even in real
YAML ` #` starts a comment, so `status: #adult` would parse as null. The status
rule is mirrored in quartz/plugins/filters/adult.ts as a second layer.

Usage:
  publish_gate.py stage  VAULT DEST   write the publishable, scrubbed copy of
                                      folders 2-5 into DEST
  publish_gate.py links  VAULT        dry run: print every line the scrub changes
  publish_gate.py report VAULT        status counts for the atomic notes
"""

import os
import re
import shutil
import sys
from collections import Counter
from pathlib import Path

PUBLISH_STATUS = "adult"

ATOMIC = "2 - atomic notes"
STAGED_FOLDERS = [ATOMIC, "3 - source material", "4 - tags", "5 - indexes"]
ATTACHMENTS = "7 - attachments"  # synced as-is by local-upload.sh, indexed here

_STATUS = re.compile(r"^status:[ \t]*[\"']?#?([A-Za-z]+)", re.MULTILINE)
_RULE = re.compile(r"^---[ \t]*$")
_HEADER_MAX_LINES = 30

_LINK = re.compile(r"(!?)\[\[([^\]|#^]*)([^\]]*)\]\]")
_LINK_SEP = re.compile(r"\s*(?:,|;|&|/|\band\b|\bor\b)?\s*", re.IGNORECASE)
_CLOSERS = re.compile(r"[\s.,;:!?)\]\"'\u201d\u2019]*")
_SEE_WORD = re.compile(r"(?:^|[\s(])(?:see(?:\s+also)?|cf\.?)\s*:?\s*$", re.IGNORECASE)
_SEE_ONLY = re.compile(r"\s*(?:(?:see(?:\s+also)?|cf\.?)\s*:?\s*)?", re.IGNORECASE)
_LABEL_END = re.compile(r"(?:[:\u2013\u2014]|(?:^|\s)-|->|\u2192)\s*$")
_SENTENCE_END = re.compile(r"[.!?;][\s\"'\u201d\u2019)]*$")
_ABBREV_END = re.compile(r"\b(?:e\.g|i\.e|vs|cf|etc)\.?\s*$", re.IGNORECASE)
_PREFIX = re.compile(r"^\s*(?:[-*+]|\d+[.)]|>|#{1,6})*\s*")
_HEADING = re.compile(r"^(#{1,6})[ \t]+\S")
_LIST_ITEM = re.compile(r"^([ \t]*)(?:[-*+]|\d+[.)])[ \t]")


# --- status gate ------------------------------------------------------------


def header_of(text: str) -> str:
    """Metadata block of a note, as raw text.

    Vault notes open (after any blank lines) with plain metadata lines
    (timestamp, status, tags) that end at the first blank line or `---` rule.
    There is no opening `---`, so this is not YAML frontmatter. Standard
    `---` ... `---` frontmatter is accepted too.
    """
    lines = text.lstrip("﻿ \t\r\n").splitlines()[:_HEADER_MAX_LINES]
    if lines and _RULE.match(lines[0]):
        lines = lines[1:]
    header = []
    for line in lines:
        if not line.strip() or _RULE.match(line):
            break
        header.append(line)
    return "\n".join(header)


def status_of(text: str) -> str:
    """Lowercased status value, or "" when the note has no usable status."""
    m = _STATUS.search(header_of(text))
    return m.group(1).lower() if m else ""


def read_status(path: Path) -> str:
    try:
        return status_of(path.read_text(encoding="utf-8", errors="replace"))
    except OSError:
        return ""


def notes(src: Path):
    return sorted(p for p in src.rglob("*") if p.is_file() and not p.name.startswith("."))


def is_publishable_atomic(path: Path) -> bool:
    return path.suffix == ".md" and read_status(path) == PUBLISH_STATUS


# --- link scrub -------------------------------------------------------------


class Index:
    """Lowercased names and vault-relative paths that wikilinks can resolve to."""

    def __init__(self):
        self.names = set()
        self.paths = []

    def add(self, rel: Path):
        self.names.add(rel.name.lower())
        self.paths.append(rel.as_posix().lower())
        if rel.suffix == ".md":
            self.names.add(rel.stem.lower())
            self.paths.append(rel.with_suffix("").as_posix().lower())

    def has(self, target: str) -> bool:
        if "/" not in target:
            return target in self.names
        t = target.lstrip("/")
        return any(p == t or p.endswith("/" + t) for p in self.paths)


def vault_index(vault: Path) -> Index:
    """Every non-hidden vault file."""
    index = Index()
    for root, dirs, files in os.walk(vault):
        dirs[:] = [d for d in dirs if not d.startswith(".")]
        for f in files:
            if not f.startswith("."):
                index.add((Path(root) / f).relative_to(vault))
    return index


def published_index(vault: Path, adult: set) -> Index:
    """What resolves to something on the published site."""
    index = Index()
    for p in adult:
        index.add(p.relative_to(vault))
    for folder in STAGED_FOLDERS[1:] + [ATTACHMENTS]:
        for p in notes(vault / folder):
            index.add(p.relative_to(vault))
    return index


def _withheld(m, published: Index, everything: Index) -> bool:
    """True if this link match points at a vault file that is not published."""
    target = m.group(2).strip().lower()
    return bool(target) and not published.has(target) and everything.has(target)


def _display(m) -> str:
    """The words a reader saw for this link: its alias, else the note name."""
    rest = m.group(3)
    alias = rest.split("|", 1)[1].strip() if "|" in rest else ""
    return alias or m.group(2).strip().rsplit("/", 1)[-1].strip()


def _is_blank(text: str) -> bool:
    """True when nothing but list/quote/heading markers and punctuation is left."""
    return not _PREFIX.sub("", text).strip(" \t.,;:&-\u2013\u2014")


def _drop_embeds(text, published, everything):
    """Embeds of unpublished files (images, notes) cannot render; remove them."""
    return _LINK.sub(
        lambda m: "" if m.group(1) and _withheld(m, published, everything) else m.group(0), text
    )


def _drop_parentheticals(text, published, everything):
    """Remove "(see [[x]])" and "([[x]])" when every link in the parens is unpublished."""

    def repl(m):
        inner = m.group(1)
        links = list(_LINK.finditer(inner))
        if not links or not all(_withheld(k, published, everything) for k in links):
            return m.group(0)
        residual = _LINK.sub("", inner)
        residual = re.sub(r"[,;&/]|\band\b|\bor\b", " ", residual, flags=re.IGNORECASE)
        return "" if _SEE_ONLY.fullmatch(residual) else m.group(0)

    return re.sub(r"[ \t]*\(([^()]*)\)", repl, text)


def _trailing_pointer(text, published, everything):
    """Handle links that form a pointer at the end of the line.

    Returns (new_text, handled). new_text None means drop the whole line.
    A tail of links is a pointer, not part of the sentence, when it follows the
    start of the line, "see", a ":" or dash label, or the end of a sentence.
    """
    ms = list(_LINK.finditer(text))
    if not ms or not _CLOSERS.fullmatch(text[ms[-1].end():]):
        return text, False
    chain = [ms[-1]]
    for prev in reversed(ms[:-1]):
        if _LINK_SEP.fullmatch(text[prev.end():chain[0].start()]):
            chain.insert(0, prev)
        else:
            break
    if not all(_withheld(m, published, everything) for m in chain):
        return text, False

    pre = text[: chain[0].start()].rstrip()
    if _is_blank(pre):
        return None, True  # the line was only pointers
    see = _SEE_WORD.search(pre)
    if see:
        head = pre[: see.start()].rstrip()
        return (head if not _is_blank(head) else None), True
    if _LABEL_END.search(pre):
        return None, True  # "annotation: [[x]]" exists only to point at x
    if _SENTENCE_END.search(pre) and not _ABBREV_END.search(pre):
        return pre, True  # a link left standing after a finished sentence
    return text, False  # the links are words in the sentence


def scrub_line(body: str, published: Index, everything: Index):
    """Hide unpublished links in one line of text (no line ending).

    Returns (new_body, how): how is "keep", "edit" or "drop"; new_body is None
    when dropped. Pointers go; links that are words in a sentence are unlinked.
    """
    if not any(_withheld(m, published, everything) for m in _LINK.finditer(body)):
        return body, "keep"
    text = _drop_embeds(body, published, everything)
    text = _drop_parentheticals(text, published, everything)
    text, _ = _trailing_pointer(text, published, everything)
    if text is None:
        return None, "drop"
    text = _LINK.sub(
        lambda m: _display(m) if _withheld(m, published, everything) else m.group(0), text
    )
    text = text.rstrip()
    if _is_blank(text):
        return None, "drop"
    return text, "edit"


def scrub_links(text: str, published: Index, everything: Index):
    """Hide links to unpublished notes. Returns (new_text, changes).

    changes is a list of (kind, before, after); kind is "drop" (line removed),
    "edit" (link removed from a sentence that stays), "child" (sub-bullet of a
    dropped line) or "section" (heading left empty).
    """
    out = []  # [line, heading level (0 = not a heading), tainted]
    changes = []
    stack = []  # indexes into `out` of the headings currently open
    fence = None
    skip_indent = None  # indent of a dropped list item; deeper lines go with it

    for line in text.splitlines(keepends=True):
        stripped = line.strip()

        if fence:
            if stripped.startswith(fence):
                fence = None
            out.append([line, 0, False])
            continue
        if stripped.startswith(("```", "~~~")):
            fence = stripped[:3]
            skip_indent = None
            out.append([line, 0, False])
            continue

        if skip_indent is not None:
            indent = len(line) - len(line.lstrip(" \t"))
            if not stripped:
                out.append([line, 0, False])
                continue
            if indent > skip_indent:
                changes.append(("child", stripped, None))
                continue
            skip_indent = None

        body = line.rstrip("\r\n")
        eol = line[len(body):]
        new_body, how = scrub_line(body, published, everything)

        if how == "drop":
            changes.append(("drop", stripped, None))
            if stack:
                out[stack[-1]][2] = True
            item = _LIST_ITEM.match(line)
            if item:
                skip_indent = len(item.group(1))
            continue
        if how == "edit":
            changes.append(("edit", stripped, new_body.strip()))
            line = new_body + eol

        heading = _HEADING.match(line)
        if heading:
            level = len(heading.group(1))
            while stack and out[stack[-1]][1] >= level:
                stack.pop()
            out.append([line, level, False])
            stack.append(len(out) - 1)
        else:
            out.append([line, 0, False])

    if not changes:
        return text, changes

    # Drop headings the removals left empty (never the H1 title).
    changed = True
    while changed:
        changed = False
        for i in range(len(out) - 1, -1, -1):
            line, level, tainted = out[i]
            if level <= 1 or not tainted:
                continue
            j = i + 1
            while j < len(out) and not out[j][0].strip():
                j += 1
            if j == len(out) or (out[j][1] and out[j][1] <= level):
                changes.append(("section", line.strip(), None))
                for k in range(i - 1, -1, -1):
                    if 0 < out[k][1] < level:
                        out[k][2] = True
                        break
                del out[i]
                changed = True
                break

    return "".join(item[0] for item in out), changes


# --- commands ---------------------------------------------------------------


def _read(path: Path) -> str:
    with open(path, encoding="utf-8", errors="replace", newline="") as fh:
        return fh.read()


def build(vault: Path, dest: Path = None):
    """Walk the publishable set. Writes to `dest` when given.

    Returns (published_count, withheld_count, scrubbed) where scrubbed is a list
    of (relative path, [(kind, before, after)]).
    """
    atomic = notes(vault / ATOMIC)
    adult = {p for p in atomic if is_publishable_atomic(p)}
    published = published_index(vault, adult)
    everything = vault_index(vault)

    count = 0
    scrubbed = []
    for folder in STAGED_FOLDERS:
        if dest is not None:
            (dest / folder).mkdir(parents=True, exist_ok=True)
        for p in notes(vault / folder):
            if folder == ATOMIC and p not in adult:
                continue
            count += 1
            rel = p.relative_to(vault)
            new_text, changes = None, []
            if p.suffix == ".md":
                new_text, changes = scrub_links(_read(p), published, everything)
            if changes:
                scrubbed.append((rel, changes))
            if dest is None:
                continue
            out = dest / rel
            out.parent.mkdir(parents=True, exist_ok=True)
            if changes:
                with open(out, "w", encoding="utf-8", newline="") as fh:
                    fh.write(new_text)
                st = p.stat()  # keep mtime so `aws s3 sync` does not re-upload
                os.utime(out, ns=(st.st_atime_ns, st.st_mtime_ns))
            else:
                shutil.copy2(p, out)
    return count, len(atomic) - len(adult), scrubbed


def cmd_stage(vault: Path, dest: Path) -> int:
    if not (vault / ATOMIC).is_dir():
        print(f"[publish_gate] not a vault: {vault}", file=sys.stderr)
        return 1
    if dest.exists():
        shutil.rmtree(dest)
    dest.mkdir(parents=True)

    count, withheld, scrubbed = build(vault, dest)
    kinds = Counter(kind for _, changes in scrubbed for kind, _, _ in changes)
    print(f"[publish_gate] staging {count} files, withholding {withheld} atomic notes")
    print(
        f"[publish_gate] link scrub across {len(scrubbed)} files: "
        f"{kinds['drop'] + kinds['child']} lines dropped, {kinds['edit']} sentences unlinked, "
        f"{kinds['section']} empty sections dropped"
    )

    # Fail closed: a parse bug or empty vault would otherwise stage nothing and
    # `aws s3 sync --delete` would wipe the remote copy.
    if not any((dest / ATOMIC).glob("**/*.md")):
        print("[publish_gate] ERROR: zero publishable notes, refusing to continue", file=sys.stderr)
        return 1
    return 0


def cmd_links(vault: Path) -> int:
    _, _, scrubbed = build(vault)
    for rel, changes in scrubbed:
        print(f"{rel}")
        for kind, before, after in changes:
            if kind == "edit":
                print(f"    ~ {before[:200]}")
                print(f"    > {after[:200]}")
            elif kind == "section":
                print(f"    - [empty section] {before[:100]}")
            elif kind == "child":
                print(f"    - [sub-bullet] {before[:100]}")
            else:
                print(f"    - {before[:120]}")
    kinds = Counter(kind for _, changes in scrubbed for kind, _, _ in changes)
    print(
        f"\n{len(scrubbed)} files: {kinds['drop']} dropped, {kinds['child']} sub-bullets, "
        f"{kinds['edit']} unlinked, {kinds['section']} empty sections"
    )
    return 0


def cmd_report(vault: Path) -> int:
    counts = Counter()
    for p in notes(vault / ATOMIC):
        counts[read_status(p) or "(none)" if p.suffix == ".md" else "(non-md)"] += 1
    for status, n in counts.most_common():
        print(f"{n:5d}  {status}")
    return 0


def main(argv: list) -> int:
    if len(argv) == 4 and argv[1] == "stage":
        return cmd_stage(Path(argv[2]), Path(argv[3]))
    if len(argv) == 3 and argv[1] == "links":
        return cmd_links(Path(argv[2]))
    if len(argv) == 3 and argv[1] == "report":
        return cmd_report(Path(argv[2]))
    print(__doc__, file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv))
