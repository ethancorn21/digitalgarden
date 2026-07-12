#!/bin/bash
# 04-deploy.sh — deploy public/ to Cloudflare Workers
# Standalone: scripts/lib/04-deploy.sh [REPO_DIR]

set -o pipefail
export PATH="/usr/local/bin:$PATH"

REPO_DIR="${1:-$(cd "$(dirname "$0")/../.." && pwd)}"

log() { echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*"; }

log "Deploying to Cloudflare Workers"
cd "$REPO_DIR" || exit 1

CLOUDFLARE_API_TOKEN="$(security find-generic-password -a "$USER" -s "cloudflare-api-token" -w 2>/dev/null)"
if [ -z "$CLOUDFLARE_API_TOKEN" ]; then
  log "[ERROR] No cloudflare-api-token found in Keychain"
  exit 1
fi
export CLOUDFLARE_API_TOKEN

MAX_ATTEMPTS=3
attempt=1
while [ "$attempt" -le "$MAX_ATTEMPTS" ]; do
  if /usr/local/bin/npx wrangler deploy; then
    log "Success"
    exit 0
  fi
  log "[ERROR] Deploy attempt $attempt/$MAX_ATTEMPTS failed"
  attempt=$((attempt + 1))
done

log "[ERROR] Deploy failed after $MAX_ATTEMPTS attempts"
exit 1
