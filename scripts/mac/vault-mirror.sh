#!/bin/bash
# vault-mirror.sh — Mac launchd job (every 15 min): copy the vault folders the essay tracer reads to the dev box over
# Tailscale, then bring back the provenance it wrote, for local-upload.sh to send on with the notes. It only moves
# files: tracing runs on the dev box (scripts/essays/trace.py), the publish policy in Fargate.
# Only these folders go, and only their .md files; rough notes, AI Gen, misc and the rest of the vault stay on the Mac.

set -o pipefail
VAULT="$HOME/Documents/Me"
DEV="${VAULT_MIRROR_DEV:-ethan@dev}"   # the dev box by its Tailscale name; set VAULT_MIRROR_DEV to override
PROVENANCE="$HOME/Library/Application Support/digitalgarden/provenance"
FOLDERS=("2 - atomic notes" "3 - source material" "4 - tags" "5 - indexes" "9 - essays")
SSH="ssh -o BatchMode=yes -o ConnectTimeout=10"

log() { echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*"; }

src=()
for f in "${FOLDERS[@]}"; do [ -d "$VAULT/$f" ] && src+=("$VAULT/$f"); done
if ! rsync -a --delete --include='*/' --include='*.md' --exclude='*' -e "$SSH" "${src[@]}" "$DEV:vault-mirror/"; then
  log "[ERROR] mirror to $DEV failed"
  exit 1
fi
mkdir -p "$PROVENANCE"
if ! rsync -a --delete --include='*.json' --exclude='*' -e "$SSH" "$DEV:.local/share/essay-trace/out/" "$PROVENANCE/"; then
  log "[WARN] no provenance pulled (the tracer may not have run yet)"
fi
log "mirrored ${#src[@]} folders"
