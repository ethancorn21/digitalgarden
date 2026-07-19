#!/bin/bash
# local-upload.sh — Mac-side launchd job: upload vault to S3, then drop the
# .sync-complete marker that fires the EventBridge rule -> Fargate pipeline.
# Replaces pipeline.sh as the local launchd target; build/deploy now happens
# entirely in the Fargate container.

set -o pipefail
export PATH="/usr/local/bin:$PATH"

BUCKET="digitalgarden-vault-sync"
VAULT="$HOME/Documents/Me"

# Must match SYNC_FOLDERS in scripts/lib/01-sync-vault.sh - only what the
# published site actually needs, not the whole vault (.obsidian, .smart-env,
# rough notes, AI Gen, etc. stay off S3 entirely).
SYNC_FOLDERS=(
  "2 - atomic notes"
  "3 - source material"
  "4 - tags"
  "5 - indexes"
  "7 - attachments"
)

log() { echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*"; }

log "Uploading vault folders to s3://$BUCKET"
for folder in "${SYNC_FOLDERS[@]}"; do
  if ! aws s3 sync "$VAULT/$folder/" "s3://$BUCKET/$folder/" --delete; then
    log "[ERROR] Upload failed for: $folder"
    exit 1
  fi
done

log "Upload complete, dropping sync-complete marker"
if ! echo "$(date -u +%Y-%m-%dT%H:%M:%SZ)" | aws s3 cp - "s3://$BUCKET/.sync-complete"; then
  log "[ERROR] Failed to write sync-complete marker"
  exit 1
fi

log "Done"
