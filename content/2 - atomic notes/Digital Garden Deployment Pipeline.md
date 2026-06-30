2026-05-18 09:00
[[homelab]]
*AI generated*

# Digital Garden Deployment Pipeline

Every night at midnight, notes written in Obsidian are automatically synced, built, and deployed to production without any manual intervention. The pipeline runs entirely on the local machine via a macOS launchd job. 

---

## The Automation: `pipeline.sh`

The pipeline is modular — an orchestrator script calls four single-purpose step scripts in sequence. Any step failure aborts the pipeline immediately, so a broken vault or failed push never results in a partial deploy.

```
scripts/
  pipeline.sh            ← launchd target (orchestrator)
  scheduled-sync.sh      ← original monolithic script, kept for rollback
  lib/
    01-sync-vault.sh     ← preflight checks + rsync
    02-git-publish.sh    ← git add / commit / push
    03-build.sh          ← npx quartz build
    04-deploy.sh         ← npx wrangler deploy
```

Each step script is also runnable standalone for debugging a specific stage.

### Stage 1 — Preflight checks + rsync (`01-sync-vault.sh`)
Verifies the vault exists and all target folders are readable before touching anything. Five Obsidian folders are mirrored into Quartz `content/` using rsync. No `--delete` flag, so files removed from the vault don't get wiped from the site:

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
  rsync -av "$VAULT/$folder/" "$CONTENT/$folder/"
done
```

### Stage 2 — Git diff, commit, push (`02-git-publish.sh`)
Checks whether rsync actually changed anything. If nothing changed, exits with code `2` — a sentinel that tells `pipeline.sh` to stop cleanly with no error. No empty commits, no unnecessary builds:

```bash
if [ -z "$(git status --porcelain)" ]; then
  echo "No changes to commit"
  exit 2  # clean stop — pipeline.sh treats this as success
fi

git add -u
git add content/
git commit -m "sync vault notes [automated]"
git push origin main
```

### Stage 3 — Build (`03-build.sh`)
Quartz compiles all markdown into a static site in `public/`:

```bash
/usr/local/bin/npx quartz build
```

### Stage 4 — Deploy (`04-deploy.sh`)
The built assets are pushed to Cloudflare Workers:

```bash
/usr/local/bin/npx wrangler deploy
```

All output (stdout + stderr) is piped to a log file by the orchestrator:

```bash
} >> "$HOME/Library/Logs/digitalgarden-sync.log" 2>&1
```

---

## What Triggers It

A macOS launchd plist fires `pipeline.sh` at midnight every day:

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
