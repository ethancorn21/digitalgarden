#!/bin/bash
# 03-build.sh — build the static site
# Standalone: scripts/lib/03-build.sh [REPO_DIR]

set -o pipefail
export PATH="/usr/local/bin:$PATH"

REPO_DIR="${1:-$(cd "$(dirname "$0")/../.." && pwd)}"

log() { echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*"; }

# SITE_ENGINE picks the generator: book (default; book/build.ts, one serif column), strata (strata/build.ts, the
# block-diagram site) or quartz. All write public/, which 04-deploy.sh ships unchanged.
SITE_ENGINE="${SITE_ENGINE:-book}"

log "Building site ($SITE_ENGINE)"
cd "$REPO_DIR" || exit 1

case "$SITE_ENGINE" in
  quartz) build_cmd=(/usr/local/bin/npx quartz build) ;;
  book) build_cmd=(/usr/local/bin/npx tsx book/build.ts "$REPO_DIR") ;;
  strata) build_cmd=(/usr/local/bin/npx tsx strata/build.ts "$REPO_DIR") ;;
  *) log "[ERROR] Unknown SITE_ENGINE '$SITE_ENGINE' (book, strata or quartz)"; exit 1 ;;
esac

if ! "${build_cmd[@]}"; then
  log "[ERROR] Build failed"
  exit 1
fi
