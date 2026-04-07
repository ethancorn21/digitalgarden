#!/bin/bash
# sync.sh — copy published vault folders into Quartz content/
# Run this before committing to push new notes to the site.

set -e

VAULT="$HOME/Documents/Me"
CONTENT="$(cd "$(dirname "$0")/.." && pwd)/content"

PUBLISH_FOLDERS=(
  "2 - source material"
  "3 - atomic notes"
  "4 - tags"
  "5 - indexes"
  "7 - attachments"
)

echo "Syncing vault → content/"

for folder in "${PUBLISH_FOLDERS[@]}"; do
  echo "  • $folder"
  mkdir -p "$CONTENT/$folder"
  rsync -a --delete \
    "$VAULT/$folder/" \
    "$CONTENT/$folder/"
done

echo "Done. Don't forget to commit and push."
