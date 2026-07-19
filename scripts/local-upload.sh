#!/bin/bash
# local-upload.sh — Mac-side launchd job: upload vault to S3, then drop the
# .sync-complete marker that fires the EventBridge rule -> Fargate pipeline.
# Replaces pipeline.sh as the local launchd target; build/deploy now happens
# entirely in the Fargate container.

set -o pipefail
export PATH="/usr/local/bin:$PATH"

BUCKET="digitalgarden-vault-sync"
VAULT="$HOME/Documents/Me"

log() { echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*"; }

log "Uploading vault to s3://$BUCKET"
if ! aws s3 sync "$VAULT/" "s3://$BUCKET/" --delete; then
  log "[ERROR] Vault upload failed"
  exit 1
fi

log "Upload complete, dropping sync-complete marker"
if ! echo "$(date -u +%Y-%m-%dT%H:%M:%SZ)" | aws s3 cp - "s3://$BUCKET/.sync-complete"; then
  log "[ERROR] Failed to write sync-complete marker"
  exit 1
fi

log "Done"
