# Minecraft Server VM
[[homelab]]
*AI generated*

## Overview
Paper Minecraft server (Java Edition) for 3-4 friends running on a dedicated Ubuntu Server VM. Isolated on VLAN 40 (untrusted public-facing services) with port forwarding through OPNsense.

## VM Specifications

| Resource    | Value                        |
| ----------- | ---------------------------- |
| Host        | SRV1 (Proxmox)               |
| vCPU        | 4                            |
| RAM         | 8GB                          |
| Storage     | 40GB                         |
| OS          | Ubuntu Server 24.04 LTS      |
| VLAN        | 40 (Untrusted Public-Facing) |
| IP          | 10.0.40.11                   |
| Server Type | Paper (optimized fork)       |
| Edition     | Java Edition                 |
| Port        | 25565 (default)              |

## Network Configuration

| Setting       | Value                            |
| ------------- | -------------------------------- |
| IP Address    | 10.0.40.11/24                    |
| Gateway       | 10.0.40.1                        |
| DNS           | <opnsense-ip> (OPNsense)             |
| Public Access | minecraft.ethanlawcorn.com:25565 |

### Why VLAN 40?
Minecraft accepts inbound connections from the internet. Public-facing services belong on VLAN 40 (untrusted but controlled by you), keeping them segmented from infrastructure (VLAN 20) and management (VLAN 10). If the server were compromised, the attacker is isolated to VLAN 40 with no lateral movement to critical infrastructure.

---

## Part 1: Destroy Old Server

If the old Minecraft VM still exists on VLAN 20:

1. Open Proxmox web UI: `https://<proxmox-ip>:8006`
2. Select the old `minecraft-server` VM
3. **Stop** the VM if running
4. Right-click the VM and select **Remove** (or click **More > Remove**)
5. Check **Purge from job configurations** and confirm
6. Remove the old port forward in OPNsense:
   - Navigate to **Firewall > NAT > Port Forward**
   - Delete the rule pointing to `<old-server-ip>`
   - Click **Apply Changes**
7. Remove any old firewall rules referencing `<old-server-ip>`

---

## Part 2: Create VM in Proxmox

### Step 1: Download Ubuntu Server 24.04 ISO

1. SSH into Proxmox (`<proxmox-ip>`)
2. Download the ISO if not already available:

```bash
cd /var/lib/vz/template/iso
wget https://releases.ubuntu.com/24.04/ubuntu-24.04.2-live-server-amd64.iso
```

You can also download through the Proxmox UI under **local > ISO Images > Download from URL**.

### Step 2: Create VM via Proxmox Web UI

1. Open Proxmox web UI: `https://<proxmox-ip>:8006`
2. Click **Create VM** (top right)

**General:**
- Node: SRV1
- VM ID: auto-assign or choose
- Name: `minecraft-server`

**OS:**
- ISO image: `ubuntu-24.04.2-live-server-amd64.iso`
- Type: Linux
- Version: 6.x - 2.6 Kernel

**System:**
- Machine: Default (i440fx)
- BIOS: Default (SeaBIOS)
- SCSI Controller: VirtIO SCSI Single
- Qemu Agent: Checked

**Disks:**
- Bus/Device: SCSI 0
- Storage: local-lvm
- Disk size: 40 GB
- Discard: Checked (for SSD TRIM)

**CPU:**
- Sockets: 1
- Cores: 4
- Type: host

**Memory:**
- Memory (MiB): 8192
- Ballooning Device: Unchecked (Minecraft needs consistent memory allocation -- ballooning can cause GC stalls and lag spikes)

**Network:**
- Bridge: vmbr1
- VLAN Tag: 40
- Model: VirtIO (paravirtualized)
- Firewall: Unchecked (managed via OPNsense)

3. Click **Finish**
4. Select the VM and click **Start**

---

## Part 3: Install Ubuntu Server

### Step 1: Boot and Install

1. In Proxmox, select the VM and click **Console**
2. VM boots into the Ubuntu installer

Follow the installer prompts:

1. **Language:** English
2. **Keyboard:** US
3. **Type of install:** Ubuntu Server
4. **Network:**
   - Select the `ens18` interface
   - Edit IPv4 > Manual:
     - Subnet: `10.0.40.0/24`
     - Address: `10.0.40.11`
     - Gateway: `10.0.40.1`
     - Name servers: `<opnsense-ip>`
5. **Proxy:** Leave blank
6. **Mirror:** Default
7. **Storage:** Use entire disk (default LVM)
8. **Profile Setup:**
   - Server name: `minecraft-server`
   - Username: your username
   - Password: strong password
9. **SSH Setup:** Install OpenSSH server: Yes
10. **Featured Snaps:** Skip all
11. **Reboot** when installation completes

### Step 2: Post-Install

After reboot, log in and update:

```bash
sudo apt update && sudo apt upgrade -y
```

Install the QEMU guest agent (for Proxmox integration):

```bash
sudo apt install -y qemu-guest-agent
sudo systemctl enable --now qemu-guest-agent
```

Verify network connectivity:

```bash
# Confirm IP
ip addr show ens18

# Test gateway
ping -c 3 10.0.40.1

# Test internet
ping -c 3 8.8.8.8

# Test DNS
ping -c 3 google.com
```

---

## Part 4: Install Java and Paper Server

### Step 1: Install Java 21

Paper requires Java 21:

```bash
sudo apt install -y openjdk-21-jre-headless

# Verify
java -version
```

Expected output: `openjdk version "21.x.x" ...`

### Step 2: Create Minecraft User

Run Minecraft as a dedicated service account (not your user or root):

```bash
# Create system user with home directory, no login shell
sudo useradd -r -m -U -d /opt/minecraft -s /bin/bash minecraft
```

### Step 3: Download Paper

```bash
# Switch to minecraft user
sudo su - minecraft

# Create and enter server directory
mkdir -p ~/server && cd ~/server

# Download latest Paper jar
# Check https://papermc.io/downloads for the current Minecraft version and build number
# Replace the version and build number in the URL below
wget https://api.papermc.io/v2/projects/paper/versions/1.21.11/builds/126/downloads/paper-1.21.11-126.jar -O paper.jar
```

> **Note:** The Paper API URL requires a specific build number. Go to https://papermc.io/downloads to find the latest version and build. The URL format is:
> `https://api.papermc.io/v2/projects/paper/versions/<VERSION>/builds/<BUILD>/downloads/paper-<VERSION>-<BUILD>.jar`

> **Important:** If a previous download was corrupted and wget saved a file with the same name, the jar may be saved with a `.1` suffix (e.g., `paper-1.21.11-69.jar.1`). Rename it before starting the server:
> ```bash
> sudo mv paper-1.21.11-69.jar.1 paper.jar
> ```

### Step 4: Initial Run and EULA

```bash
# Still as minecraft user, in /opt/minecraft/server
java -Xms4G -Xmx6G -jar paper-1.21.11-69.jar --nogui
```

The server will generate config files, print the EULA prompt, and stop. Accept the EULA:

```bash
sed -i 's/eula=false/eula=true/' eula.txt
```

### Step 5: Configure server.properties

```bash
nano server.properties
```

Key settings for your use case:

```properties
# Server identity
motd=Ethan's Minecraft Server
server-port=25565

# Players
max-players=6
white-list=true
enforce-whitelist=true
online-mode=true

# Performance -- 18 chunk render for 3-4 players
view-distance=18
simulation-distance=10

# Gameplay
difficulty=normal
gamemode=survival
enable-command-block=true
```

**What these mean:**
- `view-distance=18` -- How far players can see (in chunks). This is the render distance you wanted. It's demanding but the 8GB VM with 6GB to Paper can handle it for 3-4 players.
- `simulation-distance=10` -- How far from a player entities/redstone/crops actually tick. Keeping this lower than view distance is a big performance win. Players can *see* 18 chunks but only 10 chunks around them are actively simulated.
- `enforce-whitelist=true` -- Kicks players not on the whitelist immediately if removed, rather than waiting for reconnect.

Save and exit (`Ctrl+X`, `Y`, `Enter`).

### Step 6: Create Startup Script

```bash
nano start.sh
```

```bash
#!/bin/bash
java -Xms6G -Xmx6G \
  -XX:+UseG1GC \
  -XX:+ParallelRefProcEnabled \
  -XX:MaxGCPauseMillis=200 \
  -XX:+UnlockExperimentalVMOptions \
  -XX:+DisableExplicitGC \
  -XX:+AlwaysPreTouch \
  -XX:G1NewSizePercent=30 \
  -XX:G1MaxNewSizePercent=40 \
  -XX:G1HeapRegionSize=8M \
  -XX:G1ReservePercent=20 \
  -XX:G1HeapWastePercent=5 \
  -XX:G1MixedGCCountTarget=4 \
  -XX:InitiatingHeapOccupancyPercent=15 \
  -XX:G1MixedGCLiveThresholdPercent=90 \
  -XX:G1RSetUpdatingPauseTimePercent=5 \
  -XX:SurvivorRatio=32 \
  -XX:+PerfDisableSharedMem \
  -XX:MaxTenuringThreshold=1 \
  -Dusing.aikars.flags=https://mcflags.emc.gs \
  -Daikars.new.flags=true \
  -jar paper.jar --nogui
```

These are [Aikar's flags](https://docs.papermc.io/paper/aikars-flags), the recommended JVM tuning for Paper/Minecraft servers. The flags above are specifically tuned for 6GB+ allocations (note `G1NewSizePercent=30` and `G1MaxNewSizePercent=40` -- these values differ from the <12GB variant).

```bash
chmod +x start.sh
```

**Memory breakdown:**
- 8GB VM total
- 6GB to Minecraft (`-Xms6G -Xmx6G`)
- ~2GB left for Ubuntu OS, kernel, filesystem cache
- `-Xms` equals `-Xmx` so Java pre-allocates the full heap at startup -- prevents GC pauses from heap resizing

### Step 7: Create systemd Service

Exit the minecraft user:

```bash
exit
```

Create the service file:

```bash
sudo nano /etc/systemd/system/minecraft.service
```

```ini
[Unit]
Description=Minecraft Paper Server
After=network.target

[Service]
User=minecraft
Group=minecraft
WorkingDirectory=/opt/minecraft/server

Type=simple
ExecStart=/opt/minecraft/server/start.sh
ExecStop=/bin/kill -TERM $MAINPID

TimeoutStopSec=30
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start the service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable minecraft
sudo systemctl start minecraft
```

Verify it's running:

```bash
sudo systemctl status minecraft

# Check port is listening
sudo ss -tulpn | grep 25565
```

### Step 8: Monitor Logs

To monitor the server console output:

```bash
# View real-time logs
sudo journalctl -fu minecraft

# Or use Paper's own log file
sudo tail -f /opt/minecraft/server/logs/latest.log
```

**Note:** To run in-game commands (whitelist, op, etc.), you'll need to join the game and use the console or run commands through the server's stdin. Alternatively, you can use the Proxmox GUI console for direct server access if needed.

---

## Part 5: Configure Whitelist

**Always use the server console to manage the whitelist -- never manually edit whitelist.json.**

### Add Players

Attach to the console (see Step 8 above) and run:

```
whitelist add Player1
whitelist add Player2
whitelist list
```

### If You Don't Know Usernames Yet

Temporarily disable the whitelist so friends can join, then grab their names from logs:

```bash
# In server console
whitelist off
```

After they join:

```bash
# View who joined
sudo journalctl -u minecraft | grep "joined the game"
```

Then add them and re-enable:

```
whitelist add TheirName
whitelist on
```

---

## Part 6: OPNsense Port Forwarding

### Create Port Forward Rule

1. Open OPNsense web UI: `https://<opnsense-ip>`
2. Navigate to **Firewall > NAT > Port Forward**
3. Click **Add**

| Setting | Value |
|---------|-------|
| Interface | WAN |
| Protocol | TCP/UDP |
| Source | Any |
| Destination | WAN address |
| Destination port range | 25565 to 25565 |
| Redirect target IP | 10.0.40.11 |
| Redirect target port | 25565 |
| Description | Minecraft Server |

4. Click **Save**, then **Apply Changes**

### Verify Firewall Rule

OPNsense auto-creates a matching allow rule with port forwards. Verify under **Firewall > Rules > WAN** that a rule exists allowing TCP/UDP 25565 to `10.0.40.11`.

### VLAN 40 Firewall Considerations

Since VLAN 40 is your untrusted public-facing VLAN, make sure your OPNsense rules for the VLAN 40 interface:

- **Allow** outbound internet (for Mojang auth, Paper updates)
- **Block** traffic to VLAN 10, 20, and other internal VLANs (the Minecraft server has no business talking to your infrastructure)
- **Allow** established/related return traffic

This should already be in place from your media server VLAN setup, but verify the rules cover VLAN 40.

---

## Part 7: DNS (Porkbun)

### Update A Record

1. Login to [Porkbun](https://porkbun.com)
2. Go to DNS management for `ethanlawcorn.com`
3. If the `minecraft` A record already exists, verify it points to your current public IP
4. If not, add:

| Setting | Value |
|---------|-------|
| Type | A |
| Host | minecraft |
| Answer | Your public IP (check at https://ifconfig.me) |
| TTL | 600 |

### Verify

```bash
dig minecraft.ethanlawcorn.com
```

Should resolve to your public IP.

---

## Part 8: Connect and Test

### From Minecraft Java Edition

1. Open Minecraft Java Edition
2. **Multiplayer > Add Server**
3. Server Address: `minecraft.ethanlawcorn.com`
4. Connect

### Troubleshooting

**Can't connect externally:**
1. Is the server running? `sudo systemctl status minecraft`
2. Is the port open? `sudo ss -tulpn | grep 25565`
3. Is the port forward correct in OPNsense?
4. Test from outside your network: https://mcsrvstat.us/ (enter `minecraft.ethanlawcorn.com`)
5. Check OPNsense firewall logs: **Firewall > Log Files > Live View**

**Can connect locally but not externally:**
- Port forward issue in OPNsense
- NAT reflection may need to be set to **Pure NAT** or **NAT + Proxy** if testing from inside your network

**Lag or poor performance:**
- Check resource usage: `htop` (install with `sudo apt install htop`)
- If TPS is dropping, check with `/tps` in-game (as OP)
- Lower `simulation-distance` before lowering `view-distance`

---

## Part 9: Server Management

### Service Commands

```bash
sudo systemctl start minecraft
sudo systemctl stop minecraft
sudo systemctl restart minecraft
sudo systemctl status minecraft
```

### View Logs and Monitor Console

```bash
# View real-time service logs
sudo journalctl -fu minecraft

# View Paper's own log file
sudo tail -f /opt/minecraft/server/logs/latest.log

# Access console directly via Proxmox GUI
# Open Proxmox web UI and select the VM > Console
```

### Common In-Game Commands (as OP)

```
/op YourUsername
/whitelist add Username
/whitelist remove Username
/gamemode creative Username
/tp Player1 Player2
/time set day
/weather clear
/tps                          # Check server performance (20 = perfect)
```

### View Logs

```bash
# Live service logs
sudo journalctl -u minecraft -f

# Paper's own log file
sudo tail -f /opt/minecraft/server/logs/latest.log
```

### Update Paper

```bash
sudo systemctl stop minecraft
sudo su - minecraft
cd ~/server

# Backup current jar
cp paper.jar paper.jar.backup

# Download new version (update URL from papermc.io/downloads)
wget <new-paper-url> -O paper.jar

exit
sudo systemctl start minecraft
```

### Backup World Data

```bash
# Stop server to ensure world is saved cleanly
sudo systemctl stop minecraft

# Create timestamped backup
sudo tar -czf /home/$(whoami)/minecraft-backup-$(date +%Y%m%d).tar.gz \
  /opt/minecraft/server/world \
  /opt/minecraft/server/world_nether \
  /opt/minecraft/server/world_the_end

sudo systemctl start minecraft
```

---

## Performance Tuning

### Monitor Resources

```bash
# Interactive process viewer
htop

# Memory usage
free -h

# Disk usage
df -h
```

### Paper-Specific Tuning

Paper has its own config files for advanced tuning beyond `server.properties`:

- `config/paper-global.yml` -- Global Paper settings
- `config/paper-world-defaults.yml` -- Per-world defaults

Key settings if you need to squeeze more performance:

```yaml
# In paper-world-defaults.yml
chunks:
  max-auto-save-chunks-per-tick: 8    # Lower = less I/O lag during autosave
```

These defaults are already well-tuned out of the box. Only change them if you're seeing specific issues.

### If You Still Get Lag

Reduce in this order (least gameplay impact first):
1. Lower `simulation-distance` (10 > 8)
2. Lower `max-auto-save-chunks-per-tick` in Paper config
3. Lower `view-distance` (18 > 14) as a last resort

---

## Security

1. **Whitelist stays on** -- Public-facing server, whitelist is your first line of defense
2. **VLAN 40 isolation** -- No lateral access to management or infrastructure VLANs
3. **online-mode=true** -- Mojang account verification prevents spoofed usernames
4. **Dedicated service account** -- `minecraft` user has no sudo, limited to `/opt/minecraft`
5. **Keep Paper updated** -- Security patches for both Paper and Minecraft vulnerabilities
6. **SSH hardening** -- Use key-based auth, disable password auth if possible

---

## Quick Reference

| Item | Value |
|------|-------|
| Server IP (internal) | 10.0.40.11 |
| Server address (external) | minecraft.ethanlawcorn.com:25565 |
| Port | 25565 |
| VLAN | 40 (Untrusted Public-Facing) |
| Gateway | 10.0.40.1 |
| Server directory | /opt/minecraft/server |
| Service name | minecraft.service |
| Service user | minecraft |
| Console access | `sudo journalctl -fu minecraft` or Proxmox GUI console |
| RAM allocation | 6GB (of 8GB VM) |
| Java version | 21 |

---

## Related Documentation

- [[Docker Host VM]] - Infrastructure services
- [[Network Topology]] - VLAN configuration
- [[OPNsense VM]] - Firewall and port forwarding
- [[Domain and Reverse Proxy Setup]] - DNS management

---

## Notes

- Server auto-starts on boot via systemd
- Consider setting up a cron job for automated backups (e.g., daily at 4 AM)
- Paper provides significantly better performance than vanilla with identical gameplay -- async chunk loading, optimized entity ticking, and reduced GC pressure
- The screen session allows console access without stopping the server, unlike the old guide which required stopping the service to run commands
