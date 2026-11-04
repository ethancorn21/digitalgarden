#!/bin/bash
# vault-mirror.sh — the essay step of the nightly upload: local-upload.sh runs it, and it has no schedule of its own
# (Ethan 2026-11-04: no job waking the Mac every 15 minutes; the site only changes once a night anyway).
#
# With no #adult essay in 9 - essays it does nothing but clear the old provenance, so none is uploaded. Otherwise it
# copies the folders the tracer reads to the dev box over Tailscale, runs the tracer there (scripts/essays/trace.py),
# and brings the provenance back for local-upload.sh to send on. It only moves files and starts the tracer: tracing
# runs on the dev box, the publish policy in Fargate. Only these folders go, and only their .md files; rough notes,
# AI Gen, misc and the rest of the vault stay on the Mac.

set -o pipefail
VAULT="$HOME/Documents/Me"
DEV="${VAULT_MIRROR_DEV:-ethan@dev}"   # the dev box by its Tailscale name; set VAULT_MIRROR_DEV to override
PROVENANCE="$HOME/Library/Application Support/digitalgarden/provenance"
FOLDERS=("2 - atomic notes" "3 - source material" "4 - tags" "5 - indexes" "9 - essays")
SSH="ssh -o BatchMode=yes -o ConnectTimeout=10"
TRACE="code/projects/digitalgarden/scripts/essays/trace.py"   # on the dev box, from its home

log() { echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*"; }

mkdir -p "$PROVENANCE"
if ! grep -qs -m1 '^status:[[:space:]]*#adult' "$VAULT/9 - essays/"*.md; then
  rm -f "$PROVENANCE"/*.json
  log "no published essays: nothing to trace"
  exit 0
fi

src=()
for f in "${FOLDERS[@]}"; do [ -d "$VAULT/$f" ] && src+=("$VAULT/$f"); done
if ! rsync -a --delete --include='*/' --include='*.md' --exclude='*' -e "$SSH" "${src[@]}" "$DEV:vault-mirror/"; then
  log "[ERROR] mirror to $DEV failed"
  exit 1
fi
# the tracer keeps an essay's last good file when the AI box is busy; 20 minutes is the most this step may take
if ! $SSH "$DEV" "timeout 1200 python3 -B $TRACE vault-mirror .local/share/essay-trace/out --judge"; then
  log "[WARN] tracing failed; the last provenance stands"
fi
if ! rsync -a --delete --include='*.json' --exclude='*' -e "$SSH" "$DEV:.local/share/essay-trace/out/" "$PROVENANCE/"; then
  log "[ERROR] could not bring the provenance back"
  exit 1
fi
log "traced: $(ls "$PROVENANCE" | grep -c '\.json$') essays"
