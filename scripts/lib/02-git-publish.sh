#!/bin/bash
# 02-git-publish.sh — stage, commit, and push content changes
# Standalone: scripts/lib/02-git-publish.sh [REPO_DIR]
# Exit codes: 0 = pushed, 1 = error, 2 = no changes (clean stop)

set -o pipefail
export PATH="/usr/local/bin:$PATH"

REPO_DIR="${1:-$(cd "$(dirname "$0")/../.." && pwd)}"

log() { echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*"; }

cd "$REPO_DIR" || exit 1

if [ -z "$(git status --porcelain)" ]; then
  log "No changes to commit"
  exit 2
fi

log "Changes detected, committing"
git add -u
git add content/
git commit -m "sync vault notes [automated]"

log "Pushing to origin"
if ! git push origin main; then
  log "[ERROR] Push failed"
  exit 1
fi
