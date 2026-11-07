#!/usr/bin/env python3
"""trace.py: trace each published essay back to the notes its words came from.

Runs on the dev box against a mirror of the raw vault, started over ssh by the Mac's nightly upload right after it
rsyncs the vault over (scripts/mac/vault-mirror.sh), so it sees private notes
and the links the publish gate later scrubs. For every essay whose header says `status: #adult` it writes
OUT/<essay>.json: the borrowed phrases of the essay, the note each came from, and two generations of what those
notes drew on. Private notes appear by title only: no text, no date, no links. Essays that are not #adult get no
file, and a file whose essay is gone or withheld is deleted. Fargate's publish gate enforces the same rules again.

Layers: verbatim runs of 5+ words (quotes); IDF-weighted word overlap (rewordings); with --judge, each paragraph and
its 8 nearest notes go to the AI box's `main` model, code checks every id it answers with, and each pick is asked
again alone (clause vs that one sentence, YES/NO); clauses under 3 content words are never judged. Answers are cached by
prompt, so an unchanged paragraph costs nothing on the next run.

  trace.py VAULT OUT [--essays FOLDER] [--judge]          trace every published essay
  trace.py --gold ESSAY.md GOLD.json VAULT [--judge]      golden test: precision and recall against hand labels
"""
import argparse
import hashlib
import json
import math
import os
import re
import sys
import unicodedata
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from collections import Counter, defaultdict

STOP = set("""a an the and or but if of to in on at by for with from as is are was were be been being it its this that
these those i me my we us our you your he she they them their his her him not no so do does did have has had can could
will would should may might must just than then there here what which who whom how why when where all any some each
more most other into about over under up down out off again very too also only own same such both few one ever
every get gets got make makes made like lot""".split())
KINDS = {"books": "book", "videos": "video", "podcasts": "podcast", "lectures": "lecture", "essays": "essay",
         "quotes": "quote", "textbooks": "textbook"}
SKIP_DIRS = ("4 - tags", "5 - indexes", "7 - attachments")
SOURCES = ("2 - atomic notes", "3 - source material")   # the only folders an essay can draw on
ESSAYS = "9 - essays"
ATTACH = re.compile(r"\.(png|jpe?g|gif|webp|svg|pdf|excalidraw|canvas)$", re.I)
WORD = re.compile(r"[A-Za-z0-9]+(?:['’][A-Za-z]+)?")
LINK = re.compile(r"(!?)\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]*))?\]\]")

QUOTE_RUN = 5        # this many words in a row, verbatim, is a quote
COVER = 0.42         # share of a clause's (IDF-weighted) content words a note sentence must hold
MIN_SHARED = 2       # and at least this many content words in common


def norm_word(w):
    w = w.lower().replace("’", "'")
    if w.endswith("'s"):
        w = w[:-2]
    return w.replace("'", "")


def stem(w):
    for suf, rep in (("ations", "ate"), ("ation", "ate"), ("ies", "y"), ("ings", ""), ("ing", ""), ("edly", ""),
                     ("ed", ""), ("ness", ""), ("ment", ""), ("ly", ""), ("es", ""), ("s", "")):
        if w.endswith(suf) and len(w) - len(suf) >= 3:
            w = w[: -len(suf)] + rep
            break
    return w.rstrip("e") if len(w) > 4 else w


def words(text):
    """[(start, end, normalized word)] over text."""
    return [(m.start(), m.end(), norm_word(m.group())) for m in WORD.finditer(text)]


def content(ws):
    return [stem(w) for _, _, w in ws if w not in STOP and not w.isdigit()]


def split_header(text):
    """Vault notes have no YAML: leading `key: value` / date lines, ended by a blank line or `---`."""
    lines, head, date, i = text.split("\n"), {}, None, 0
    while i < len(lines):
        l = lines[i].strip()
        if l in ("", "---"):
            i += 1
            break
        m = re.match(r"^(\d{4}-\d{1,2}-\d{1,2})", l)
        if m and date is None:
            date = m.group(1)
        elif re.match(r"^[a-z]+:", l):
            k, _, v = l.partition(":")
            head[k] = v.strip()
        else:
            break
        i += 1
    if date is None and re.match(r"^\d{4}-\d{1,2}-\d{1,2}", head.get("start", "")):
        date = head["start"]
    return head, date, "\n".join(lines[i:])


def iso(d):
    if not d:
        return None
    y, m, dd = d.split("-")
    return f"{y}-{int(m):02d}-{int(dd):02d}"


def clean(body):
    body = re.sub(r"!\[\[[^\]]*\]\]", " ", body)
    body = LINK.sub(lambda m: m.group(3) or m.group(2), body)
    body = re.sub(r"^\s{0,3}(#+|>|[-*+]|\d+\.)\s*", "", body, flags=re.M)
    return re.sub(r"[*_`]", "", body)


def sentences(text):
    out = []
    for line in text.split("\n"):
        out += [s.strip() for s in re.split(r"(?<=[.!?\"”])\s+", line) if len(WORD.findall(s)) >= 3]
    return out


ANCESTRY = 2         # generations behind the notes the essay used: enough to explore, short enough to stay legible


def page_slug(title):
    """The garden's address for a note (book/build.ts `clean`)."""
    s = unicodedata.normalize("NFKD", title)
    s = "".join(ch for ch in s if not unicodedata.combining(ch)).lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-") or "note"


def load_vault(root):
    """id -> node. id is the note's file title, which is what [[links]] use."""
    nodes = {}
    for dirpath, _, files in [w for src in SOURCES for w in os.walk(os.path.join(root, src))]:
        rel = os.path.relpath(dirpath, root)
        for f in files:
            if not f.endswith(".md") or f == "index.md":
                continue
            text = open(os.path.join(dirpath, f), encoding="utf-8").read()
            head, date, body = split_header(text)
            parts = rel.split(os.sep)
            kind = "note" if "atomic" in parts[0] else KINDS.get(parts[1] if len(parts) > 1 else "", "source")
            refs = sorted({m.group(2).strip() for m in LINK.finditer(body) if not m.group(1)
                           and not ATTACH.search(m.group(2))})
            private = kind == "note" and "#adult" not in head.get("status", "")
            title = f[:-3]
            nodes[title] = {"title": title, "date": iso(date), "kind": kind, "private": private, "refs": refs,
                            "url": head.get("source") or None, "by": head.get("author") or None,
                            "sents": sentences(clean(body))}
    tags = set()
    for d in SKIP_DIRS[:2]:
        p = os.path.join(root, d)
        if os.path.isdir(p):
            tags |= {f[:-3] for _, _, fs in os.walk(p) for f in fs if f.endswith(".md")}
    for n in list(nodes.values()):
        n["refs"] = [r for r in n["refs"] if r not in tags and r != n["title"]]
        for r in n["refs"]:   # a link with no file behind it is a note the vault holds back
            nodes.setdefault(r, {"title": r, "date": None, "kind": "note", "private": True, "refs": [], "url": None,
                                 "by": None, "sents": []})
    return nodes


COMMENT = re.compile(r"%%(.*?)%%", re.S)
QUOTED = r'["\u201c](.+?)["\u201d]'
TITLE = r"\[\[([^\]|#]+)(?:[#|][^\]]*)?\]\]"
QUOTES = str.maketrans("\u201c\u201d\u2018\u2019", "\"\"''")   # one character for one, so positions hold


def read_overrides(body):
    """Ethan's own fixes, written in the essay inside an Obsidian comment (%% ... %%, hidden when he reads it):

         not [[Note]]                 never link this note anywhere in the essay
         not "a phrase"               unlink this phrase, whatever note it went to
         "a phrase" -> [[Note]]       link this phrase to this note, whatever the tracer found

    One per line, a list bullet in front is fine. Applied after tracing, so they always win.
    """
    o = {"not_notes": set(), "not_phrases": [], "force": []}
    for block in COMMENT.findall(body):
        for line in block.splitlines():
            l = re.sub(r"^\s*[-*+]\s*", "", line).strip()
            if m := re.fullmatch(r"not:?\s*" + TITLE, l, re.I):
                o["not_notes"].add(m[1].strip().lower())
            elif m := re.fullmatch(r"not:?\s*" + QUOTED, l, re.I):
                o["not_phrases"].append(m[1])
            elif m := re.fullmatch(QUOTED + r"\s*(?:->|\u2192|=>)\s*" + TITLE, l):
                o["force"].append((m[1], m[2].strip()))
    return o


def read_essay(path):
    head, date, body = split_header(open(path, encoding="utf-8").read())
    overrides, body = read_overrides(body), COMMENT.sub("", body)
    title, paras = None, []
    for block in re.split(r"\n\s*\n", body):
        b = re.sub(r"^\s*---\s*$", "", block, flags=re.M).strip()
        if not b:
            continue
        if b.startswith("# ") and "\n" in b and title is None:   # a title line glued to its first paragraph
            b, rest = b.split("\n", 1)
            title = b[2:].strip()
            b = rest.strip()
        if b.startswith("# ") and title is None:
            title = b[2:].strip()
        elif not b.startswith("#"):
            paras.append(" ".join(b.split()))
    return {"title": title or os.path.basename(path)[:-3], "date": iso(date), "paragraphs": paras,
            "overrides": overrides}


def _find(para, phrase):
    """Where a phrase stands in a paragraph; case, quote style and spacing do not matter."""
    words = [re.escape(w) for w in phrase.translate(QUOTES).lower().split()]
    m = re.search(r"\s+".join(words), para.translate(QUOTES).lower()) if words else None
    return (m.start(), m.end()) if m else None


def _carve(spans, para, s, e):
    """The spans with [s, e) cut out of them; a piece left with fewer than 3 words goes."""
    out = []
    for sp in spans:
        if sp["end"] <= s or sp["start"] >= e:
            out.append(sp)
            continue
        for a, b in ((sp["start"], s), (e, sp["end"])):
            seg = para[a:b] if b > a else ""
            a2, b2 = a + len(seg) - len(seg.lstrip(" ,;:")), b - (len(seg) - len(seg.rstrip(" ,;:")))
            if b > a and len(WORD.findall(para[a2:b2])) >= 3:
                out.append({**sp, "start": a2, "end": b2})
    return out


def apply_overrides(out, o, nodes):
    """Ethan's fixes (read_overrides) over what the tracer found. A fix that matches nothing is reported, not guessed."""
    if not o or not (o["not_notes"] or o["not_phrases"] or o["force"]):
        return out
    titles = {k.lower(): k for k in nodes}
    hit = set()
    for p in out:
        para, spans = p["text"], p["spans"]
        spans = [sp for sp in spans if sp["node"].lower() not in o["not_notes"]]
        for phrase in o["not_phrases"]:
            if at := _find(para, phrase):
                spans, _ = _carve(spans, para, *at), hit.add(("not", phrase))
        for phrase, title in o["force"]:
            at, node = _find(para, phrase), titles.get(title.lower())
            if at and node:
                spans = _carve(spans, para, *at) + [{"start": at[0], "end": at[1], "node": node, "kind": "p",
                                                      "score": 9, "match": None}]
                hit.add(("force", phrase))
        spans.sort(key=lambda sp: sp["start"])
        for sp in spans:
            sp["text"] = para[sp["start"]:sp["end"]]
        p["spans"] = spans
    for phrase in o["not_phrases"]:
        if ("not", phrase) not in hit:
            print(f'fix not applied: "{phrase}" is not in the essay', file=sys.stderr)
    for phrase, title in o["force"]:
        if title.lower() not in titles:
            print(f"fix not applied: no note called [[{title}]]", file=sys.stderr)
        elif ("force", phrase) not in hit:
            print(f'fix not applied: "{phrase}" is not in the essay', file=sys.stderr)
    return out


def clauses(para):
    """(start, end) pieces of a paragraph: sentences, cut again at , ; : when both sides keep 4+ words."""
    out = []
    for m in re.finditer(r"[^.!?]+[.!?”\"]*\s*", para):
        s, e = m.start(), m.end()
        cuts = [s] + [c.end() for c in re.finditer(r"[,;:—]\s+", para[s:e])] + [e - s]
        cuts = [s] + [s + c for c in cuts[1:-1]] + [e]
        keep = [cuts[0]]
        for c in cuts[1:-1]:
            if len(WORD.findall(para[keep[-1]:c])) >= 4 and len(WORD.findall(para[c:e])) >= 4:
                keep.append(c)
        keep.append(e)
        out += list(zip(keep, keep[1:]))
    return out


def longest_run(a, b):
    best, prev = 0, [0] * (len(b) + 1)
    for x in a:
        cur = [0] * (len(b) + 1)
        for j, y in enumerate(b):
            if x == y:
                cur[j + 1] = prev[j] + 1
                best = max(best, cur[j + 1])
        prev = cur
    return best


TOP_NOTES = 8        # notes per paragraph the judge sees
MIN_JUDGED = 3       # a rewording needs at least this many content words of its own: "On attention." carries no idea
VERIFY = """One clause from an essay and one sentence from the author's own notes.

CLAUSE: {clause}
NOTE SENTENCE ({note}): {sent}

Which is true?
A. The clause carries this sentence's idea: it quotes it, rewords it, or makes the same point (even loosely).
B. Same topic or theme, but the clause makes a different point.
C. Unrelated: they only share a word or a mood.
Answer with one letter: A, B or C."""
JUDGE = """You trace where an essay's ideas came from in the author's own notes.

Below is one essay paragraph cut into numbered clauses, then candidate notes with numbered sentences.
For each clause, decide whether it was drawn from ONE specific note sentence: it quotes it, rewords it, or states the
same specific idea. Sharing a topic or a common word is NOT enough. Fresh writing, transitions and conclusions the notes
never state get no source. When unsure, give no source.

Answer with only a JSON array, one object per clause that has a source:
[{{"clause": 1, "note": "N2", "sentence": 3}}]
An empty array [] is a fine answer.

PARAGRAPH
{clauses}

NOTES
{notes}"""


def lc_chat(prompt):
    cfg = os.path.expanduser("~/.config/localcompute")
    url = open(os.path.join(cfg, "url")).read().strip() + "/v1/chat/completions"
    token = open(os.path.join(cfg, "token")).read().strip()
    body = json.dumps({"model": "main", "temperature": 0, "max_tokens": 1500,
                       "chat_template_kwargs": {"enable_thinking": False},
                       "messages": [{"role": "user", "content": prompt}]}).encode()
    req = urllib.request.Request(url, body, {"Content-Type": "application/json", "Authorization": f"Bearer {token}"})
    with urllib.request.urlopen(req, timeout=1800) as r:
        ans = json.load(r)["choices"][0]["message"]["content"]
    if not ans:
        raise RuntimeError("judge: the model returned no answer")
    return ans


def judge_paragraph(para, units, ranked, nodes, cache_dir):
    """[(unit index, node id, sentence)] the model vouches for, each id checked against what it was shown."""
    cands = ranked[:TOP_NOTES]
    if not cands:
        return []
    cl = "\n".join(f"{i + 1}. {para[s:e].strip()}" for i, (s, e) in enumerate(units))
    nt = "\n\n".join(f"N{k + 1}: {nid}\n" + "\n".join(f"  {j + 1}. {t}" for j, t in enumerate(nodes[nid]["sents"]))
                     for k, nid in enumerate(cands))
    prompt = JUDGE.format(clauses=cl, notes=nt)
    os.makedirs(cache_dir, exist_ok=True)
    key = os.path.join(cache_dir, hashlib.sha256(("nothink\n" + prompt).encode()).hexdigest()[:20] + ".txt")
    if os.path.exists(key):
        ans = open(key, encoding="utf-8").read()
    else:
        ans = lc_chat(prompt)
        open(key, "w", encoding="utf-8").write(ans)
    ans = re.sub(r"<think>.*?</think>", "", ans, flags=re.S)
    m = re.search(r"\[.*\]", ans, re.S)
    try:
        picks = json.loads(m.group()) if m else []
    except json.JSONDecodeError:
        print(f"judge: unreadable answer cached at {key}", file=sys.stderr)
        return []
    out = []
    for p in picks if isinstance(picks, list) else []:
        try:
            u, k, j = int(p["clause"]) - 1, int(str(p["note"]).lstrip("Nn")) - 1, int(p["sentence"]) - 1
        except (KeyError, TypeError, ValueError):
            continue
        if 0 <= u < len(units) and 0 <= k < len(cands) and 0 <= j < len(nodes[cands[k]]["sents"]):
            out.append((u, cands[k], nodes[cands[k]]["sents"][j]))
    return out


def ask_cached(prompt, cache_dir):
    os.makedirs(cache_dir, exist_ok=True)
    key = os.path.join(cache_dir, hashlib.sha256(("nothink\n" + prompt).encode()).hexdigest()[:20] + ".txt")
    if os.path.exists(key):
        return open(key, encoding="utf-8").read()
    ans = lc_chat(prompt)
    open(key, "w", encoding="utf-8").write(ans)
    return ans


def verify_pick(clause, nid, sent, cache_dir):
    """Second look at one judge pick, alone: the first pass chooses among eight notes at once and over-reaches
    (Ethan 2026-11-07: Plato's Forms traced to a Bootstrap note on web forms). Unsure or unreadable = no."""
    ans = re.sub(r"<think>.*?</think>", "", ask_cached(VERIFY.format(clause=clause.strip(), note=nid, sent=sent), cache_dir), flags=re.S)
    return re.match(r"\W*A\b", ans.strip()) is not None


def trace(essay, nodes, judge=False, cache_dir=".judge-cache"):
    pool = []   # (node id, sentence or None for the title, word list, content set)
    for nid, n in nodes.items():
        pool.append((nid, None, [w for _, _, w in words(nid)], set(content(words(nid)))))
        for s in n["sents"]:
            ws = words(s)
            pool.append((nid, s, [w for _, _, w in ws], set(content(ws))))
    df = Counter(w for p in pool for w in p[3])
    idf = {w: math.log(len(pool) / c) for w, c in df.items()}
    inv = defaultdict(list)
    for i, p in enumerate(pool):
        for w in p[3]:
            inv[w].append(i)

    # notes reach the judge by TF-IDF cosine of the whole note against the whole paragraph; length-normalized, so a long
    # lecture note does not outrank a short note just by having more sentences to get lucky with
    bags = {n: Counter(w for t in [n] + v["sents"] for w in content(words(t))) for n, v in nodes.items()}
    ndf = Counter(w for b in bags.values() for w in b)
    nidf = {w: math.log(len(bags) / c) for w, c in ndf.items()}

    def vec(bag):
        v = {w: (1 + math.log(c)) * nidf.get(w, 0) for w, c in bag.items()}
        z = math.sqrt(sum(x * x for x in v.values())) or 1
        return {w: x / z for w, x in v.items()}

    nvec = {n: vec(b) for n, b in bags.items()}

    passes = []   # lexical pass over every paragraph first, so the judge calls can run side by side
    for para in essay["paragraphs"]:
        units, lex = clauses(para), {}
        for ui, (s, e) in enumerate(units):
            ws = words(para[s:e])
            raw, cs = [w for _, _, w in ws], set(content(ws))
            if not cs:
                continue
            total = sum(idf.get(w, math.log(len(pool))) for w in cs)
            cand = {i for w in cs for i in inv.get(w, ())}
            best = None
            for i in cand:
                nid, sent, praw, pcs = pool[i]
                shared = cs & pcs
                cover = sum(idf[w] for w in shared) / total
                run = longest_run(raw, praw) if len(shared) >= 2 else 0
                if run >= QUOTE_RUN:
                    score, kind = 1 + run / 100, "q" if run >= 0.6 * len(raw) else "p"
                elif cover >= COVER and len(shared) >= MIN_SHARED:
                    score, kind = cover, "p"
                else:
                    continue
                if best is None or score > best[0]:
                    best = (score, kind, nid, sent)
            if best:
                lex[ui] = best
        pv = vec(Counter(content(words(para))))
        cos = {n: sum(pv.get(w, 0) * x for w, x in v.items()) for n, v in nvec.items() if nodes[n]["sents"]}
        passes.append((para, units, lex, sorted((n for n in cos if cos[n] > 0), key=lambda n: -cos[n])))
    if judge:
        with ThreadPoolExecutor(len(passes) or 1) as ex:
            verdicts = list(ex.map(lambda ps: judge_paragraph(ps[0], ps[1], ps[3], nodes, cache_dir), passes))
        for (para, units, lex, _), picks in zip(passes, verdicts):
            # a verbatim run is proof and stays; every rewording needs the judge's word
            for ui in [ui for ui, b in lex.items() if b[1] != "q"]:
                del lex[ui]
            picks = [(ui, nid, sent) for ui, nid, sent in picks if ui not in lex
                     and len(set(content(words(para[units[ui][0]:units[ui][1]])))) >= MIN_JUDGED]
            with ThreadPoolExecutor(min(8, len(picks)) or 1) as vx:
                keep = list(vx.map(lambda pk: verify_pick(para[units[pk[0]][0]:units[pk[0]][1]], pk[1], pk[2], cache_dir), picks))
            for (ui, nid, sent), ok in zip(picks, keep):
                if ok:
                    lex.setdefault(ui, (0.5, "p", nid, sent))

    out = []
    for para, units, lex, _ in passes:
        hits = []
        for ui in sorted(lex):
            s, e = units[ui]
            best = lex[ui]
            hits.append({"start": s, "end": e, "node": best[2], "kind": best[1], "score": round(best[0], 3),
                         "match": None if nodes[best[2]]["private"] else best[3]})
        # trim each span to its words, then join neighbours from the same note
        spans = []
        for h in hits:
            seg = para[h["start"]:h["end"]]
            h["start"] += len(seg) - len(seg.lstrip())
            h["end"] -= len(seg) - len(seg.rstrip())
            if spans and spans[-1]["node"] == h["node"] and not para[spans[-1]["end"]:h["start"]].strip(" ,;:"):
                spans[-1]["end"], spans[-1]["score"] = h["end"], max(spans[-1]["score"], h["score"])
            else:
                spans.append(h)
        for sp in spans:
            sp["text"] = para[sp["start"]:sp["end"]]
        out.append({"text": para, "spans": spans})

    out = apply_overrides(out, essay.get("overrides"), nodes)
    used = {sp["node"] for p in out for sp in p["spans"]}
    # the whole ancestry, so a reader can keep clicking back; a private note is a dead end: its links stay hidden
    keep, edge = set(used), set(used)
    for _ in range(ANCESTRY):
        edge = {r for u in edge if not nodes[u]["private"] for r in nodes[u]["refs"]} - keep
        keep |= edge
    public = {}
    for k in sorted(keep):
        n = nodes[k]
        public[k] = ({"kind": "note", "private": True, "date": None, "refs": []} if n["private"] else
                     {"kind": n["kind"], "private": False, "date": n["date"], "refs": n["refs"], "url": n["url"]})
    return {"essay": {"title": essay["title"], "date": essay["date"]}, "paragraphs": out, "nodes": public}


def provenance(prov, file):
    """The file the site reads: the essay's borrowed phrases in reading order and the notes; never a note's text."""
    spans = [{"text": sp["text"], "node": sp["node"], "kind": sp["kind"]} for p in prov["paragraphs"] for sp in p["spans"]]
    return {"v": 1, "essay": file, "spans": spans, "nodes": prov["nodes"]}


def is_adult(path):
    head, _, _ = split_header(open(path, encoding="utf-8").read())
    return "#adult" in head.get("status", "")


def trace_all(vault, out, folder, judge, cache):
    src = os.path.join(vault, folder)
    os.makedirs(out, exist_ok=True)
    essays = sorted(f for f in os.listdir(src) if f.endswith(".md")) if os.path.isdir(src) else []
    keep, nodes = set(), None
    for f in essays:
        if not is_adult(os.path.join(src, f)):
            continue
        nodes = nodes or load_vault(vault)
        name = f[:-3] + ".json"
        keep.add(name)
        try:
            data = provenance(trace(read_essay(os.path.join(src, f)), nodes, judge=judge, cache_dir=cache), f)
        except (OSError, RuntimeError, ValueError) as e:   # the AI box down or busy: keep the last good file
            print(f"skipped {f}: {e}", file=sys.stderr)
            continue
        body = json.dumps(data, indent=1, ensure_ascii=False, sort_keys=True) + "\n"
        target = os.path.join(out, name)
        if not os.path.exists(target) or open(target, encoding="utf-8").read() != body:
            tmp = target + ".tmp"
            open(tmp, "w", encoding="utf-8").write(body)
            os.replace(tmp, target)
            print(f"traced {f}: {len(data['spans'])} borrowings from {len({s['node'] for s in data['spans']})} notes")
    for name in os.listdir(out):   # withheld or deleted essays lose their file
        if name.endswith(".json") and name not in keep:
            os.remove(os.path.join(out, name))
            print(f"removed {name}: its essay is gone or not #adult")
    return 0


def score_gold(prov, gold_path):
    """Character-level agreement with hand labels: which note each borrowed character belongs to."""
    gold = json.load(open(gold_path, encoding="utf-8"))
    text = "\n".join(p["text"] for p in prov["paragraphs"])
    want, got, offs = [None] * len(text), [None] * len(text), 0
    for p in prov["paragraphs"]:
        for sp in p["spans"]:
            for k in range(offs + sp["start"], offs + sp["end"]):
                got[k] = sp["node"]
        offs += len(p["text"]) + 1
    rows = []
    for g in gold:
        i = text.index(g["text"])
        for k in range(i, i + len(g["text"])):
            want[k] = g["note"]
        right = sum(got[k] == g["note"] for k in range(i, i + len(g["text"])))
        other = Counter(got[k] for k in range(i, i + len(g["text"])) if got[k] != g["note"]).most_common(1)
        rows.append((right / len(g["text"]), g, other[0][0] if other else None))
    letters = [k for k, ch in enumerate(text) if ch.strip()]
    tp = sum(1 for k in letters if got[k] and got[k] == want[k])
    pred = sum(1 for k in letters if got[k])
    real = sum(1 for k in letters if want[k])
    wrong_own = sum(1 for k in letters if got[k] and not want[k])
    print(f"precision {tp / max(pred, 1):.2f}  recall {tp / max(real, 1):.2f}  "
          f"(chars; {wrong_own} chars of fresh writing wrongly attributed)")
    for frac, g, other in rows:
        mark = "hit " if frac >= 0.5 else "MISS"
        extra = f"  -> got {other}" if other and frac < 0.5 else ""
        print(f"  {mark} {frac:4.0%} {g['kind']} {g['note'][:28]:28} {g['text'][:60]}{extra}")
    return tp / max(pred, 1), tp / max(real, 1)


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("paths", nargs="+")
    ap.add_argument("--essays", default=ESSAYS)
    ap.add_argument("--gold", action="store_true", help="golden test: ESSAY.md GOLD.json VAULT")
    ap.add_argument("--judge", action="store_true", help="second layer: local model on the AI box")
    a = ap.parse_args()
    cache = os.path.join(os.path.expanduser("~/.cache/essay-trace"), "judge")
    if a.gold:
        essay, gold, vault = a.paths
        p, r = score_gold(trace(read_essay(essay), load_vault(vault), judge=a.judge, cache_dir=cache), gold)
        return 0
    vault, out = a.paths
    return trace_all(vault, out, a.essays, a.judge, cache)


if __name__ == "__main__":
    sys.exit(main())
