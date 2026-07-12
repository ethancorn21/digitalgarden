#!/bin/bash
# 03-build.sh — build Quartz static site
# Standalone: scripts/lib/03-build.sh [REPO_DIR]

set -o pipefail
export PATH="/usr/local/bin:$PATH"

REPO_DIR="${1:-$(cd "$(dirname "$0")/../.." && pwd)}"

log() { echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*"; }

log "Building site"
cd "$REPO_DIR" || exit 1

if ! /usr/local/bin/npx quartz build; then
  log "[ERROR] Build failed"
  exit 1
fi
