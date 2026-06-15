2026-06-14 00:00

# Digital Garden EC2 Deployment Guide
*AI Generated*
[[homelab]], [[SAA-C03]]

Move the automated vault sync + deploy pipeline from a local launchd job (Mac must be awake) to an always-on EC2 instance using the official Obsidian headless client.

## Why

Local launchd job runs `scheduled-sync.sh` nightly at midnight — syncs Obsidian vault → builds Quartz → deploys to Cloudflare Workers. Problem: Mac asleep or off = no sync, no deploy. EC2 fixes this.

GitHub Actions was ruled out — it clones shallow with fake git timestamps, which breaks the sidebar sort order in Quartz.

## Architecture

```
Obsidian (Mac) ──Obsidian Sync──► EC2 t3.micro
                                      │
                                  obsidian-headless (systemd)
                                  keeps vault in sync
                                      │
                                  cron @ midnight
                                  scheduled-sync.sh
                                      │
                            git commit + push + wrangler deploy
                                      │
                              Cloudflare Workers (prod)
```

## Steps

### 1. Launch EC2 Instance

- AMI: Ubuntu 24.04 LTS
- Instance type: `t3.micro` (free tier eligible)
- Storage: 20GB gp3
- Security group: allow SSH (port 22) from your IP only
- Create or reuse a key pair, download `.pem`

### 2. Connect and Update

```bash
ssh -i your-key.pem ubuntu@<EC2_PUBLIC_IP>
sudo apt update && sudo apt upgrade -y
```

### 3. Install obsidian-headless

Follow the official docs at obsidian.md/help/headless. At time of writing:

```bash
# Download the obsidian-headless binary (check official docs for latest URL)
curl -L https://obsidian.md/headless/linux -o obsidian-headless
chmod +x obsidian-headless
sudo mv obsidian-headless /usr/local/bin/
```

Authenticate with your Obsidian account:

```bash
obsidian-headless login
```

Point it at a local vault directory and start syncing:

```bash
mkdir -p ~/vault
obsidian-headless sync --vault ~/vault --remote "YOUR_VAULT_NAME"
```

### 4. Run obsidian-headless as a systemd Service

```ini
# /etc/systemd/system/obsidian-headless.service
[Unit]
Description=Obsidian Headless Sync
After=network.target

[Service]
User=ubuntu
ExecStart=/usr/local/bin/obsidian-headless sync --vault /home/ubuntu/vault --remote "YOUR_VAULT_NAME"
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable obsidian-headless
sudo systemctl start obsidian-headless
sudo systemctl status obsidian-headless
```

### 5. Install Node and Wrangler

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node -v && npm -v
```

### 6. Clone the Digital Garden Repo

```bash
git clone git@github.com:ethancorn21/digitalgarden.git ~/digitalgarden
cd ~/digitalgarden
npm install
```

Set up git identity:

```bash
git config user.name "ethancorn"
git config user.email "insert email"
```

### 7. Authenticate Wrangler

```bash
npx wrangler login
```

Follow the browser OAuth flow (will need to open the URL on your Mac).

### 8. Update scheduled-sync.sh Vault Path

The script currently points at `~/Documents/Me`. Update it to point at the EC2 vault:

```bash
# In scripts/scheduled-sync.sh, change:
VAULT="$HOME/Documents/Me"
# To:
VAULT="$HOME/vault"
```

Commit and push this change from your Mac before the EC2 pulls it.

### 9. Set Up Cron on EC2

```bash
crontab -e
```

Add:

```
0 0 * * * /bin/bash /home/ubuntu/digitalgarden/scripts/scheduled-sync.sh
```

### 10. Disable Local launchd Job

On your Mac:

```bash
launchctl unload ~/Library/LaunchAgents/com.user.digitalgarden-sync.plist
```

Keep the plist file around in case you want to re-enable it.

### 11. Verify

Wait for the next midnight run or trigger manually:

```bash
bash ~/digitalgarden/scripts/scheduled-sync.sh
```

Check logs:

```bash
tail -f ~/Library/Logs/digitalgarden-sync.log
# (log path is set inside the script — update it for EC2 if needed)
```

## Notes

- obsidian-headless requires an active Obsidian Sync subscription
- Vault sync is continuous (systemd service), cron only handles the git/build/deploy step
- SSH key for GitHub needs to be set up on the EC2 instance (`~/.ssh/id_ed25519`)
- Wrangler auth token may expire — check `npx wrangler whoami` periodically

## Sources

- [Obsidian Headless - Official Docs](https://obsidian.md/help/headless)
- [Obsidian Sync Goes Headless - Mr. Latte](https://www.mrlatte.net/en/stories/2026/02/28/obsidian-sync-now-has-a-headless-client/)
- [Headless Obsidian Sync on Linux - TechDufus](https://techdufus.com/blog/headless-obsidian-sync-on-linux/)
- [obsidian-headless-sync-docker - GitHub](https://github.com/Belphemur/obsidian-headless-sync-docker)
- [Obsidian Sync Headless Announcement - AlternativeTo](https://alternativeto.net/news/2026/3/obsidian-sync-now-supports-headless-operation-for-workflow-automation-ci-pipelines-and-more/)
