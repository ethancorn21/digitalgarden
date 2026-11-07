#!/usr/bin/env python3
"""check_embeds.py: refuse an upload when a published note embeds an image the vault mirror does not have.
Obsidian Sync skips files over its size cap (5 MB on Standard) without telling the dev box, so a new full-size
painting can be missing from the mirror; the upload's `s3 sync --delete` would then take it off the site, and the
build only logs "embed dropped" in Fargate. Run by local-upload.sh on the gated stage, so only published notes count.
Embeds resolve the way book/build.ts resolves them: ![[file]] or ![[file|400]], matched case-insensitively against
7 - attachments; only image targets are checked (embedded notes and other files are the build's business).
  check_embeds.py STAGE ATTACHMENTS     exit 1 and name each missing image, else exit 0
"""
import re
import sys
from pathlib import Path

EMBED = re.compile(r"!\[\[([^\]|]+)(?:\|[^\]]*)?\]\]")
IMAGE = re.compile(r"\.(png|jpe?g|gif|webp|svg)$", re.I)


def main(argv):
    if len(argv) != 2:
        print(__doc__, file=sys.stderr)
        return 2
    stage, attach = Path(argv[0]), Path(argv[1])
    have = {p.name.lower() for p in attach.iterdir()} if attach.is_dir() else set()
    missing = []
    for note in sorted(stage.rglob("*.md")):
        for target in EMBED.findall(note.read_text(encoding="utf-8", errors="replace")):
            t = target.strip()
            if IMAGE.search(t) and t.lower() not in have:
                missing.append((note.relative_to(stage), t))
    for note, t in missing:
        print(f"[check-embeds] {note}: embeds {t}, which is not in the vault mirror "
              f"(over Obsidian Sync's size cap? shrink it on the Mac)", file=sys.stderr)
    return 1 if missing else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
