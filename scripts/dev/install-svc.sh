#!/bin/bash
# install-svc.sh — set up the svc user that runs the garden jobs on the dev box (run with sudo; safe to re-run).
# svc owns the vault mirror, the Obsidian login and the AWS key; ethan and the agents running as ethan cannot read
# them. Tools svc runs are root-owned or svc-owned, never under /home, so an agent cannot swap the code either.
#   sudo bash install-svc.sh [REV]     REV = digitalgarden commit for svc's checkout (default: GitHub main)
# Timers are installed but not enabled: enable them at cutover, after the Mac job is off.
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "run with sudo" >&2; exit 1; }
HERE="$(cd "$(dirname "$0")" && pwd)"
REV="${1:-main}"
OB_SRC="${OB_SRC:-/home/ethan/opt/obsidian-headless}"

id svc >/dev/null 2>&1 || useradd --system --home-dir /var/lib/svc --create-home --shell /usr/sbin/nologin svc
chmod 700 /var/lib/svc
install -d -o svc -g svc -m 700 /var/lib/svc/vault /var/lib/svc/vault/Me /var/lib/svc/.aws /var/lib/svc/.config

# Obsidian Headless: a root-owned copy of the pinned install (lockfile included), so svc runs code no agent can edit.
if [ -d "$OB_SRC/node_modules/obsidian-headless" ]; then
  rm -rf /opt/obsidian-headless.new
  cp -a "$OB_SRC" /opt/obsidian-headless.new
  chown -R root:root /opt/obsidian-headless.new
  chmod -R go-w /opt/obsidian-headless.new
  rm -rf /opt/obsidian-headless && mv /opt/obsidian-headless.new /opt/obsidian-headless
fi
printf '#!/bin/sh\nexec sudo -u svc -H /usr/bin/node /opt/obsidian-headless/node_modules/obsidian-headless/cli.js "$@"\n' > /usr/local/bin/svc-ob
chmod 755 /usr/local/bin/svc-ob

# svc's own checkout, pinned to REV; update by hand with this script after reading the diff.
if [ ! -d /var/lib/svc/digitalgarden/.git ]; then
  sudo -u svc -H git clone -q https://github.com/ethancorn21/digitalgarden.git /var/lib/svc/digitalgarden
fi
sudo -u svc -H git -C /var/lib/svc/digitalgarden fetch -q origin
sudo -u svc -H git -C /var/lib/svc/digitalgarden checkout -q --detach "origin/$REV" 2>/dev/null \
  || sudo -u svc -H git -C /var/lib/svc/digitalgarden checkout -q --detach "$REV"
echo "svc checkout: $(sudo -u svc -H git -C /var/lib/svc/digitalgarden log --oneline -1)"

for u in vault-pull.service garden-upload.service; do
  sed -e "/^#HARDENING$/r $HERE/hardening.conf" -e '/^#HARDENING$/d' "$HERE/$u" > "/etc/systemd/system/$u"
done
install -m 644 "$HERE/vault-pull.timer" "$HERE/garden-upload.timer" /etc/systemd/system/
systemctl daemon-reload
echo "installed; timers not enabled (cutover: systemctl enable --now vault-pull.timer garden-upload.timer)"
