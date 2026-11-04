#!/bin/bash
# install-vault-mirror.sh — run once on the Mac: schedules vault-mirror.sh every 15 minutes (launchd).
set -e
REPO="$(cd "$(dirname "$0")/../.." && pwd)"
PLIST="$HOME/Library/LaunchAgents/com.user.vault-mirror.plist"
cat > "$PLIST" <<PL
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>com.user.vault-mirror</string>
<key>ProgramArguments</key><array><string>/bin/bash</string><string>$REPO/scripts/mac/vault-mirror.sh</string></array>
<key>StartInterval</key><integer>900</integer>
<key>RunAtLoad</key><true/>
<key>StandardOutPath</key><string>$HOME/Library/Logs/vault-mirror.log</string>
<key>StandardErrorPath</key><string>$HOME/Library/Logs/vault-mirror.log</string>
</dict></plist>
PL
launchctl unload "$PLIST" 2>/dev/null || true
launchctl load "$PLIST"
echo "installed: every 15 min, log at ~/Library/Logs/vault-mirror.log"
