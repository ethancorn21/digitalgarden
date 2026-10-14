#!/bin/bash
# 01b-publish-gate.sh — enforce the publish policy on content/ before it is committed
# Standalone: scripts/lib/01b-publish-gate.sh [REPO_DIR]
#
# Runs between the S3 sync and the git commit, so withheld notes never reach the
# public repo or the site. Policy lives in publish-gate.ts. MANIFEST is the
# vault's file list, uploaded by the Mac next to the notes.

set -o pipefail
export PATH="/usr/local/bin:$PATH"

REPO_DIR="${1:-$(cd "$(dirname "$0")/../.." && pwd)}"
MANIFEST="${PUBLISH_MANIFEST:-/tmp/vault/_manifest.txt}"

log() { echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*"; }

log "Applying publish gate"
cd "$(dirname "$0")/../.." || exit 1

if ! npx tsx scripts/lib/publish-gate.ts apply "$REPO_DIR/content" "$MANIFEST"; then
  log "[ERROR] Publish gate failed"
  exit 1
fi
