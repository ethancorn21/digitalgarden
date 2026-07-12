#!/bin/bash
# pipeline.sh — modular orchestrator for vault sync + deploy
# Drop-in replacement for scheduled-sync.sh as the launchd target.
# Revert: point launchd back at scheduled-sync.sh.

set -o pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
LIB="$SCRIPT_DIR/lib"
LOG_FILE="/dev/stdout"

{
  "$LIB/01-sync-vault.sh" "$REPO_DIR" || exit 1

  "$LIB/02-git-publish.sh" "$REPO_DIR"
  case $? in
    0) ;;        # pushed — continue to build + deploy
    2) exit 0 ;; # no changes — clean stop
    *) exit 1 ;; # error
  esac

  "$LIB/03-build.sh" "$REPO_DIR" || exit 1

  "$LIB/04-deploy.sh" "$REPO_DIR" || exit 1

} >> "$LOG_FILE" 2>&1
