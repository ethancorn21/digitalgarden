#!/bin/bash
# scheduled-sync.sh — automated nightly sync of vault to GitHub

set -o pipefail

VAULT="$HOME/Documents/Me"
REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CONTENT="$REPO_DIR/content"
LOG_FILE="$HOME/Library/Logs/digitalgarden-sync.log"

{
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] Starting sync"

  # Check vault is accessible
  if [ ! -d "$VAULT" ]; then
    echo "[ERROR] Vault not found: $VAULT"
    exit 1
  fi

  # Verify content directory exists
  mkdir -p "$CONTENT"

  SYNC_FOLDERS=(
    "2 - source material"
    "3 - atomic notes"
    "4 - tags"
    "5 - indexes"
    "7 - attachments"
  )

  # Check all folders are readable before syncing
  for folder in "${SYNC_FOLDERS[@]}"; do
    if [ ! -r "$VAULT/$folder" ]; then
      echo "[ERROR] Cannot read vault folder: $folder"
      exit 1
    fi
  done

  # Sync each folder (without --delete to prevent wipeouts)
  for folder in "${SYNC_FOLDERS[@]}"; do
    mkdir -p "$CONTENT/$folder"
    if ! rsync -a "$VAULT/$folder/" "$CONTENT/$folder/"; then
      echo "[ERROR] Sync failed for: $folder"
      exit 1
    fi
  done

  echo "[$(date +'%Y-%m-%d %H:%M:%S')] Sync complete, checking for changes"

  # Go to repo and check for changes
  cd "$REPO_DIR" || exit 1

  if [ -z "$(git status --porcelain)" ]; then
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] No changes to commit"
    exit 0
  fi

  # Stage, commit, and push
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] Changes detected, committing"
  git add -u
  git add content/
  git commit -m "sync vault notes [automated]"

  echo "[$(date +'%Y-%m-%d %H:%M:%S')] Pushing to origin"
  if ! git push origin main; then
    echo "[ERROR] Push failed"
    exit 1
  fi

  echo "[$(date +'%Y-%m-%d %H:%M:%S')] Building site"
  if ! /usr/local/bin/npx quartz build; then
    echo "[ERROR] Build failed"
    exit 1
  fi

  echo "[$(date +'%Y-%m-%d %H:%M:%S')] Deploying to Cloudflare Workers"
  if /usr/local/bin/npx wrangler deploy; then
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] Success"
  else
    echo "[ERROR] Deploy failed"
    exit 1
  fi

} >> "$LOG_FILE" 2>&1
