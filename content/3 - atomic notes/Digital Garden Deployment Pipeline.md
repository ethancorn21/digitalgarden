2026-05-18 09:00
[[homelab]]
*AI generated*

# Digital Garden Deployment Pipeline

Every night at midnight, notes written in Obsidian are automatically synced, built, and deployed to production without any manual intervention. The pipeline runs entirely on the local machine via a macOS launchd job.

---

## The Automation: `scheduled-sync.sh`

The heart of the pipeline is a single bash script. It runs five sequential stages, and bails out immediately if any stage fails — so a broken vault or failed push never results in a partial deploy.

### Stage 1 — Preflight checks
Before touching anything, the script verifies the vault exists and all target folders are readable:

```bash
if [ ! -d "$VAULT" ]; then
  echo "[ERROR] Vault not found: $VAULT"
  exit 1
fi

for folder in "${SYNC_FOLDERS[@]}"; do
  if [ ! -r "$VAULT/$folder" ]; then
    echo "[ERROR] Cannot read vault folder: $folder"
    exit 1
  fi
done
```

### Stage 2 — rsync vault → content/
Five Obsidian folders are mirrored into the Quartz `content/` directory using rsync. The `-a` flag preserves timestamps and handles subdirectories. No `--delete` flag, so files removed from the vault don't get wiped from the site:

```bash
SYNC_FOLDERS=(
  "2 - source material"
  "3 - atomic notes"
  "4 - tags"
  "5 - indexes"
  "7 - attachments"
)

for folder in "${SYNC_FOLDERS[@]}"; do
  mkdir -p "$CONTENT/$folder"
  rsync -a "$VAULT/$folder/" "$CONTENT/$folder/"
done
```

### Stage 3 — Git diff, commit, push
The script checks whether rsync actually changed anything. If nothing changed, it exits early — no empty commits, no unnecessary builds:

```bash
if [ -z "$(git status --porcelain content/)" ]; then
  echo "No changes to commit"
  exit 0
fi

git add content/
git commit -m "sync vault notes [automated]"
git push origin main
```

### Stage 4 — Build
Quartz compiles all markdown into a static site in `public/`:

```bash
npx quartz build
```

### Stage 5 — Deploy
The built assets are pushed to Cloudflare Workers:

```bash
npx wrangler deploy
```

All output (stdout + stderr) is piped to a log file:

```bash
} >> "$HOME/Library/Logs/digitalgarden-sync.log" 2>&1
```

---

## What Triggers It

A macOS launchd plist fires the script at midnight every day:

```xml
<key>StartCalendarInterval</key>
<dict>
  <key>Hour</key><integer>0</integer>
  <key>Minute</key><integer>0</integer>
</dict>
```

Plist location: `~/Library/LaunchAgents/com.user.digitalgarden-sync.plist`

---

## Manual Deploy

```bash
cd ~/code/projects/digitalgarden
npx quartz build && npx wrangler deploy
```

---

## Logs

```
~/Library/Logs/digitalgarden-sync.log
~/Library/Logs/digitalgarden-sync-error.log
```
