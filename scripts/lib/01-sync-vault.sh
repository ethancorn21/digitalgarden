#!/bin/bash
# 01-sync-vault.sh — rsync vault folders into content/
# Standalone: scripts/lib/01-sync-vault.sh [REPO_DIR]

set -o pipefail
export PATH="/usr/local/bin:$PATH"

VAULT="/tmp/vault"
aws s3 sync s3://digitalgarden-vault-sync "$VAULT" --delete

REPO_DIR="${1:-$(cd "$(dirname "$0")/../.." && pwd)}"
CONTENT="$REPO_DIR/content"

# The site is essays only (Ethan 2026-11-07): an #adult note in 9 - essays, the images essays embed, and the essays'
# provenance (scripts/essays/trace.py, run on the dev box). The folders published before are deleted from content/, so
# the commit takes them off the public repo and the site, whatever an older uploader left in the bucket
SYNC_FOLDERS=(
  "9 - essays"
  "7 - attachments"
)
RETIRED_FOLDERS=(
  "2 - atomic notes"
  "3 - source material"
  "4 - tags"
  "5 - indexes"
)

log() { echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*"; }

log "Starting sync"

if [ ! -d "$VAULT" ]; then
  log "[ERROR] Vault not found: $VAULT"
  exit 1
fi

mkdir -p "$CONTENT"

for folder in "${SYNC_FOLDERS[@]}"; do
  if [ ! -r "$VAULT/$folder" ]; then
    log "[ERROR] Cannot read vault folder: $folder"
    exit 1
  fi
done
for folder in "${RETIRED_FOLDERS[@]}"; do
  rm -rf "${CONTENT:?}/$folder"
done

if [ -d "$VAULT/_provenance" ]; then
  SYNC_FOLDERS+=("_provenance")
else
  rm -rf "${CONTENT:?}/_provenance"
fi

for folder in "${SYNC_FOLDERS[@]}"; do
  mkdir -p "$CONTENT/$folder"
  if ! rsync -av --delete "$VAULT/$folder/" "$CONTENT/$folder/"; then
    log "[ERROR] Sync failed for: $folder"
    exit 1
  fi
done

log "Sync complete, checking for changes"
