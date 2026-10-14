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

# Folders 2-5 go through the publish gate (lib/publish_gate.py): only
# `status: #adult` atomic notes are kept, and lines linking to unpublished notes
# are scrubbed from everything that remains. S3, the public git repo and the
# site never see #baby notes or their titles. The gate fails closed (non-zero
# exit -> nothing uploads). 7 - attachments is synced as-is.
UNSTAGED_FOLDER="7 - attachments"
GATE="$(cd "$(dirname "$0")" && pwd)/lib/publish_gate.py"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

log() { echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*"; }

log "Running publish gate"
if ! /usr/bin/python3 -B -I "$GATE" stage "$VAULT" "$STAGE"; then
  log "[ERROR] Publish gate failed"
  exit 1
fi

log "Uploading vault folders to s3://$BUCKET"
for folder in "${SYNC_FOLDERS[@]}"; do
  if [ "$folder" = "$UNSTAGED_FOLDER" ]; then
    src="$VAULT/$folder"
  else
    src="$STAGE/$folder"
  fi
  if ! aws s3 sync "$src/" "s3://$BUCKET/$folder/" --delete; then
    log "[ERROR] Upload failed for: $folder"
    exit 1
  fi
done

# The container's gate needs the names of every vault file, including notes that
# are never uploaded (rough notes, misc), to hide links that point at them.
log "Uploading vault manifest"
(cd "$VAULT" && find . -type f ! -path '*/.*' | sed 's|^\./||' | sort) > "$STAGE/_manifest.txt"
if ! aws s3 cp "$STAGE/_manifest.txt" "s3://$BUCKET/_manifest.txt"; then
  log "[ERROR] Manifest upload failed"
  exit 1
fi

log "Upload complete, dropping sync-complete marker"
if ! echo "$(date -u +%Y-%m-%dT%H:%M:%SZ)" | aws s3 cp - "s3://$BUCKET/.sync-complete"; then
  log "[ERROR] Failed to write sync-complete marker"
  exit 1
fi

log "Done"
