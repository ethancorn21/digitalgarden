# Media Server Project

[[homelab]] : *AI WRITTEN REPORT*

# Project Overview

A complete media server stack across two physical servers, with external access for family members to request and stream media without needing a VPN.

**What we are building:**
- Automated media downloading (torrents via VPN) on SRV1
- Media serving via Jellyfin on SRV2 (TrueNAS Scale) with hardware transcoding
- Family-facing request portal (Jellyseerr) so anyone can request movies/shows
- Traefik reverse proxy in a DMZ for secure external access
- All backed by TrueNAS raidz2 storage over NFS

**External URLs:**
- `jellyfin.ethanlawcorn.com` - Media streaming
- `requests.ethanlawcorn.com` - Media request portal

---
## Physical Look

![[IMG_3161.jpeg | 400]]
yes there is a dead drive :/

---
## Architecture

```
INTERNET
    |
AT&T BGW320 (IP Passthrough)
    |
[OPNsense - Dedicated Hardware]
    |
    |--- WAN (public IP, dynamic)
    |--- VLAN 10 - Management (10.0.10.0/24) - existing
    |--- VLAN 40 - DMZ (10.0.40.0/24) - NEW
    |--- VLAN 45 - Untrusted Servers (10.0.45.0/24) - NEW
    |
[DSW1 - Cisco 2960-X] --- fiber --- [ASW1 - Cisco 2960-X]
                                          |
                    +---------+-----------+-----------+
                    |                     |           |
              [SRV1 Proxmox]        [SRV2 TrueNAS]  ...
              nic3 (vmbr1)          VLAN 45 access
              VLAN trunk            port
                    |
        +-----------+-----------+
        |                       |
  [Traefik VM]           [Media Docker VM]
  VLAN 40                VLAN 45
  10.0.40.10             10.0.45.20
        |                       |
   Traefik               Gluetun (AirVPN)
   reverse proxy          qBittorrent
                          Prowlarr
                          Sonarr
                          Radarr
                          Bazarr
                          Jellyseerr
                                |
                          NFS mount ──────> [SRV2 TrueNAS Scale]
                                             10.0.45.10
                                             Pool: NAS (raidz2)
                                             Pool: fast (1TB NVMe)
                                             Jellyfin app (iGPU transcode)
```

### Traffic Flows

**Media request and download flow:**
1. Family member opens `requests.ethanlawcorn.com`, requests a movie
2. Jellyseerr sends request to Radarr (same Docker host)
3. Radarr queries Prowlarr for releases (through VPN via Gluetun)
4. Prowlarr searches public indexers, returns results
5. Radarr picks best release, sends .torrent to qBittorrent (through VPN via Gluetun)
6. qBittorrent downloads through AirVPN tunnel, writes to NFS mount on TrueNAS
7. Radarr detects completion, hardlinks file from downloads to media library (server-side NFS operation, instant)
8. Jellyfin detects new media in library
9. Family member watches on `jellyfin.ethanlawcorn.com`

**External access flow:**
1. User hits `jellyfin.ethanlawcorn.com` (DNS resolves to your dynamic public IP)
2. AT&T BGW320 passes through to OPNsense WAN
3. OPNsense port forwards 443 to Traefik (10.0.40.10)
4. Traefik terminates SSL, routes to Jellyfin (10.0.45.10:8096) based on hostname
5. OPNsense firewall allows VLAN 40 to VLAN 45 on port 8096
6. Jellyfin serves content (hardware transcoded via i7-9700k iGPU if needed)

---

## Infrastructure Summary

| Device          | Role                  | VLAN      | IP                  | OS            |
| --------------- | --------------------- | --------- | ------------------- | ------------- |
| OPNsense        | Firewall/Router       | All       | 10.0.x.1 (gateways) | OPNsense      |
| SRV1            | Hypervisor            | 10 (mgmt) | 10.0.10.10          | Proxmox       |
| SRV2            | NAS + Jellyfin        | 45        | 10.0.45.10          | TrueNAS Scale |
| Traefik VM      | Reverse proxy         | 40        | 10.0.40.10          | Ubuntu Server |
| Media Docker VM | Arr stack + downloads | 45        | 10.0.45.20          | Ubuntu Server |

| Service | Host | Port | Access |
|---------|------|------|--------|
| Traefik Dashboard | 10.0.40.10 | 8080 | Internal only (VPN in) |
| qBittorrent WebUI | 10.0.45.20 | 8080 | Internal only (VPN in) |
| Prowlarr | 10.0.45.20 | 9696 | Internal only |
| Sonarr | 10.0.45.20 | 8989 | Internal only |
| Radarr | 10.0.45.20 | 7878 | Internal only |
| Bazarr | 10.0.45.20 | 6767 | Internal only |
| Jellyseerr | 10.0.45.20 | 5055 | External via Traefik |
| Jellyfin | 10.0.45.10 | 8096 | External via Traefik |

---

## Phase 1: Network Foundation

This phase creates VLANs 40 and 45 on your switches and OPNsense, then sets up firewall rules.

### 1.1 Switch Configuration (ASW1 and DSW1)

You need to create both VLANs on both switches and ensure all trunk links carry them.

**On BOTH ASW1 and DSW1:**
```
enable
configure terminal

vlan 40
 name DMZ
vlan 45
 name UNTRUSTED-SERVERS
exit
```

**On the trunk between ASW1 and DSW1 (fiber link):**
Identify the trunk interface on each switch. Add VLANs 40 and 45 to the allowed list.
```
! Run on BOTH switches, on the fiber trunk interface
interface <FIBER-TRUNK-INTERFACE>
 switchport trunk allowed vlan add 40,45
exit
```

**On ASW1 - trunk to SRV1 (Proxmox nic3/vmbr1):**
This trunk already carries VLANs 10, 20, 30. Add 40 and 45.
```
interface <SRV1-TRUNK-INTERFACE>
 switchport trunk allowed vlan add 40,45
exit
```

**On ASW1 (or DSW1, wherever SRV2 is connected) - access port for SRV2 (TrueNAS):**
```
interface <SRV2-INTERFACE>
 switchport mode access
 switchport access vlan 45
 no shutdown
exit
```

**On DSW1 - trunk to OPNsense:**
```
interface <OPNSENSE-TRUNK-INTERFACE>
 switchport trunk allowed vlan add 40,45
exit
```

**Verify on both switches:**
```
show vlan brief
show interfaces trunk
```

Confirm VLANs 40 and 45 appear in the VLAN table and are allowed on all relevant trunks.

### 1.2 OPNsense VLAN Interfaces

You already have VLAN sub-interfaces for 10, 20, 30 on OPNsense. Follow the same process for 40 and 45.

**Create VLAN interfaces:**
1. Interfaces > Other Types > VLAN > Add
   - Parent: your LAN interface (same parent as existing VLANs)
   - VLAN tag: 40
   - Description: DMZ
2. Repeat for VLAN tag 45, description: UNTRUSTED_SERVERS

**Assign interfaces:**
1. Interfaces > Assignments
   - Add the new VLAN 40 interface, name it `DMZ`
   - Add the new VLAN 45 interface, name it `UNTRUSTED`
2. Configure each:
   - DMZ: Static IPv4 = `10.0.40.1/24`, enable interface
   - UNTRUSTED: Static IPv4 = `10.0.45.1/24`, enable interface

**Optional - DHCP (not needed if using only static IPs):**
Skip DHCP for these VLANs since all devices will have static IPs.

### 1.3 OPNsense Firewall Rules

Rules are processed top-to-bottom, first match wins. Configure on each VLAN interface.

**VLAN 40 (DMZ) - Firewall Rules:**

| Order | Action | Source | Destination | Port | Protocol | Description |
|-------|--------|--------|-------------|------|----------|-------------|
| 1 | Pass | DMZ net | 10.0.45.10 | 8096 | TCP | Traefik to Jellyfin |
| 2 | Pass | DMZ net | 10.0.45.20 | 5055 | TCP | Traefik to Jellyseerr |
| 3 | Block | DMZ net | VLAN10 net | * | * | Block DMZ to Management |
| 4 | Block | DMZ net | VLAN20 net | * | * | Block DMZ to Servers |
| 5 | Block | DMZ net | VLAN30 net | * | * | Block DMZ to Lab |
| 6 | Block | DMZ net | VLAN45 net | * | * | Block remaining DMZ to Untrusted |
| 7 | Pass | DMZ net | * | * | * | Allow internet (Let's Encrypt, DDNS) |

Rules 1-2 allow Traefik to reach specific backend services. Rules 3-6 block all other internal/cross-VLAN traffic. Rule 7 allows internet access for SSL certificates and DDNS updates.

**VLAN 45 (Untrusted Servers) - Firewall Rules:**

| Order | Action | Source | Destination | Port | Protocol | Description |
|-------|--------|--------|-------------|------|----------|-------------|
| 1 | Block | UNTRUSTED net | VLAN10 net | * | * | Block to Management |
| 2 | Block | UNTRUSTED net | VLAN20 net | * | * | Block to Servers |
| 3 | Block | UNTRUSTED net | VLAN30 net | * | * | Block to Lab |
| 4 | Block | UNTRUSTED net | VLAN40 net | * | * | Block to DMZ |
| 5 | Pass | UNTRUSTED net | * | * | * | Allow internet (VPN tunnel, updates) |

VLAN 45 needs internet access for the AirVPN tunnel and container image updates. It cannot initiate connections to any other internal VLAN. Intra-VLAN traffic (e.g., Docker VM to TrueNAS on VLAN 45) is switched at L2 and does not pass through OPNsense.

**NAT / Port Forwarding (Firewall > NAT > Port Forward):**

| Interface | Protocol | Destination Port | Redirect Target | Redirect Port | Description      |
| --------- | -------- | ---------------- | --------------- | ------------- | ---------------- |
| WAN       | TCP      | 80               | 10.0.40.10      | 80            | HTTP to Traefik  |
| WAN       | TCP      | 443              | 10.0.40.10      | 443           | HTTPS to Traefik |

### 1.4 Verify Network Connectivity

After completing the above, test from a device on each VLAN:
- From VLAN 40: ping 10.0.40.1 (gateway), ping 8.8.8.8 (internet)
- From VLAN 45: ping 10.0.45.1 (gateway), ping 8.8.8.8 (internet)
- From VLAN 45: ping between 10.0.45.10 and 10.0.45.20 (intra-VLAN)
- From VLAN 40: verify you CANNOT ping 10.0.10.x, 10.0.20.x, 10.0.30.x (blocked)
- From VLAN 45: verify you CANNOT ping 10.0.10.x, 10.0.40.x (blocked)

---

## Phase 2: TrueNAS Scale Setup (SRV2 - 10.0.45.10)

### 2.1 Network Configuration

1. In TrueNAS web UI: Network > Global Configuration
   - Hostname: `srv2`
   - Default Gateway: `10.0.45.1`
   - Nameserver: `10.0.45.1` (or `1.1.1.1`)
2. Network > Interfaces
   - Configure primary interface with static IP `10.0.45.10/24`
   - No VLAN tag needed (SRV2 is on an access port, switch handles tagging)

### 2.2 Dataset Creation

The key design principle: put downloads and media under a SINGLE parent dataset so that hardlinks work. When Sonarr/Radarr "import" a completed download, they create a hardlink instead of copying the file. This only works when source and destination are on the same ZFS dataset.

**On pool "NAS" - create the data dataset and subdirectories:**

1. Storage > Pools > NAS > Add Dataset
   - Name: `data`
   - Compression: `lz4` (default, good for media)
   - Atime: `off` (reduces unnecessary writes)
   - Record size: leave default (128K)

2. Inside `NAS/data`, create subdirectories (NOT child datasets - they must be regular directories for hardlinks to work):
   - This will be done via shell or after NFS mount

**On pool "fast" - Jellyfin metadata:**

1. Storage > Pools > fast > Add Dataset
   - Name: `jellyfin`
   - Compression: `lz4`
   - Atime: `off`

### 2.3 Create Directory Structure

SSH into TrueNAS or use Shell from the web UI:

```bash
# Media library directories
mkdir -p /mnt/NAS/data/media/movies
mkdir -p /mnt/NAS/data/media/tv

# Download directories
mkdir -p /mnt/NAS/data/torrents/complete
mkdir -p /mnt/NAS/data/torrents/incomplete

# Jellyfin directories on fast pool
mkdir -p /mnt/fast/jellyfin/config
mkdir -p /mnt/fast/jellyfin/cache
```

### 2.4 User and Permissions

Create a dedicated user for media services. This user's UID must match the PUID used by Docker containers on the Media VM (1000).

1. Credentials > Local Users > Add
   - Username: `media`
   - UID: `1000` (must match Docker containers)
   - Primary Group: create new group `media` with GID `1000`
   - Home Directory: `/nonexistent`
   - Shell: `nologin`
   - Disable password (service account only)

2. Set ownership on data directories:
```bash
chown -R media:media /mnt/NAS/data
chmod -R 775 /mnt/NAS/data

chown -R media:media /mnt/fast/jellyfin
chmod -R 775 /mnt/fast/jellyfin
```

**IMPORTANT:** If TrueNAS already has a user with UID 1000 (sometimes a default user), you will need to either use that UID or pick a different one. Whatever UID you use here, use the same PUID/PGID in all Docker containers on the Media VM.

### 2.5 NFS Share Configuration

We export a single share (`NAS/data`) to the Media Docker VM. This is critical for hardlinks to work - both downloads and media must be on the same NFS mount.

1. Sharing > Unix Shares (NFS) > Add
   - Path: `/mnt/NAS/data`
   - Description: `Media data - downloads and library`
   - Mapall User: `media` (maps all NFS client operations to the media user)
   - Mapall Group: `media`
   - Authorized Networks: `10.0.45.0/24` (restrict to VLAN 45 only)
   - Leave other settings default

2. Services > NFS
   - Enable NFS service
   - Set to start automatically
   - NFSv4 enabled (check "Enable NFSv4")
   - Number of servers: 4 (or more if SRV2 has many cores)

**Note:** We do NOT need to NFS-export the `fast/jellyfin` dataset. Jellyfin runs directly on TrueNAS and accesses it locally.

### 2.6 iGPU Passthrough for Jellyfin

The i7-9700k has Intel UHD Graphics 630. TrueNAS Scale can pass this to apps for hardware transcoding.

**Important pre-check:** Make sure your TrueNAS Scale version supports GPU passthrough to apps. Electric Eel (24.10+) uses Docker-based apps. Older versions (Dragonfish, Cobia) use Kubernetes-based apps. The steps differ. Check your version at System > General.

**For Electric Eel (24.10+):**
1. System Settings > Advanced > GPU
   - Ensure the Intel UHD 630 is listed
   - Set GPU to be available for apps (do NOT isolate it for the host unless you want console output)
2. When installing the Jellyfin app (next step), you will select the GPU in the app configuration

**For older versions (Dragonfish/Cobia):**
1. Apps > Settings > Advanced Settings
   - Select Intel GPU under "GPU Passthrough"

### 2.7 Jellyfin App Installation

1. Apps > Discover > Search "Jellyfin" > Install

2. Configuration during install:
   - **Network:** Host network = enabled (simplest for same-VLAN access)
     - This makes Jellyfin accessible at `10.0.45.10:8096`
   - **Storage:**
     - Config storage: Host path = `/mnt/fast/jellyfin/config`
     - Cache storage: Host path = `/mnt/fast/jellyfin/cache`
     - Add additional storage mount:
       - Host path: `/mnt/NAS/data/media`
       - Mount path: `/media`
       - Read only: yes (Jellyfin only needs to read media)
   - **GPU:** Select Intel UHD 630 for hardware transcoding
   - **User/Group:** Run as UID 1000, GID 1000 (matches the `media` user)

3. After installation, access Jellyfin at `http://10.0.45.10:8096`
4. Complete the first-run wizard:
   - Create admin account with a strong password (4 random words)
   - Add media libraries:
     - Movies: `/media/movies`
     - TV Shows: `/media/tv`
   - Enable hardware transcoding:
     - Dashboard > Playback > Transcoding
     - Hardware acceleration: Intel QuickSync (QSV)
     - Enable: H264, HEVC, VP9 (check all that your iGPU supports)
     - Enable hardware decoding for all supported codecs
     - Enable tone mapping (for HDR to SDR conversion)

---

## Phase 3: Media Docker VM (10.0.45.20)

### 3.1 VM Creation in Proxmox

1. On Proxmox web UI, create a new VM:
   - **Name:** media-docker
   - **OS:** Ubuntu Server 24.04 LTS ISO
   - **CPU:** 4 cores
   - **RAM:** 8192 MB (8 GB)
   - **Disk:** 50 GB (OS + Docker images + container configs; media is on NFS)
   - **Network:**
     - Bridge: `vmbr1`
     - VLAN Tag: `45`
     - Model: VirtIO

2. Install Ubuntu Server with defaults
   - Set hostname: `media-docker`
   - Create your user account
   - Enable OpenSSH server during install

### 3.2 Static IP Configuration

After Ubuntu is installed, configure static IP via netplan.

Edit `/etc/netplan/00-installer-config.yaml` (or whatever the config file is named):

```yaml
network:
  version: 2
  ethernets:
    ens18:  # interface name may vary, check with 'ip a'
      dhcp4: false
      addresses:
        - 10.0.45.20/24
      routes:
        - to: default
          via: 10.0.45.1
      nameservers:
        addresses:
          - 1.1.1.1
          - 8.8.8.8
```

```bash
sudo netplan apply
```

Verify: `ping 10.0.45.1` (gateway), `ping 10.0.45.10` (TrueNAS), `ping 8.8.8.8` (internet).

### 3.3 Docker Installation

```bash
# Install Docker using the official convenience script
curl -fsSL https://get.docker.com | sudo sh

# Add your user to the docker group (log out and back in after)
sudo usermod -aG docker $USER
```

Log out, log back in, then verify: `docker run hello-world`

### 3.4 NFS Client Setup

```bash
# Install NFS client
sudo apt install nfs-common -y

# Create mount point
sudo mkdir -p /data

# Test manual mount
sudo mount -t nfs4 10.0.45.10:/mnt/NAS/data /data

# Verify: you should see the directories we created earlier
ls /data/media /data/torrents
```

If the mount works, make it persistent via `/etc/fstab`:
```
10.0.45.10:/mnt/NAS/data  /data  nfs4  defaults,_netdev  0  0
```

Reboot and verify the mount persists: `df -h | grep data`

### 3.5 Docker Compose - Media Stack

Create the project directory:
```bash
sudo mkdir -p /opt/media-stack
cd /opt/media-stack
```

Create `/opt/media-stack/docker-compose.yml`:

```yaml
services:

  # --- VPN Container ---
  # All qBittorrent and Prowlarr traffic routes through this
  gluetun:
    image: qmcgaw/gluetun
    container_name: gluetun
    cap_add:
      - NET_ADMIN
    ports:
      - 8080:8080   # qBittorrent WebUI
      - 9696:9696   # Prowlarr (routed through VPN)
      - 8191:8191   # FlareSolverr (routed through VPN)
    volumes:
      - ./gluetun:/gluetun
    environment:
      - VPN_SERVICE_PROVIDER=airvpn
      - VPN_TYPE=wireguard
      - WIREGUARD_PRIVATE_KEY=<YOUR_WIREGUARD_PRIVATE_KEY>
      - WIREGUARD_PRESHARED_KEY=<YOUR_WIREGUARD_PRESHARED_KEY>
      - WIREGUARD_ADDRESSES=<YOUR_WIREGUARD_ADDRESS>
      - SERVER_COUNTRIES=<YOUR_PREFERRED_COUNTRY>
      - FIREWALL_OUTBOUND_SUBNETS=172.16.0.0/12
      # The subnet above allows VPN'd containers to reach other
      # Docker containers on the local compose network (e.g.,
      # Prowlarr reaching Sonarr/Radarr). Without this, containers
      # behind Gluetun can only reach the internet through the VPN.
      - FIREWALL_VPN_INPUT_PORTS=<YOUR_AIRVPN_FORWARDED_PORT>
      # Without a forwarded port, qBittorrent can only make outgoing
      # connections. No peers can connect inbound, which severely
      # limits download speeds. Request a port from AirVPN first
      # (Client Area > Ports > Manage), then put it here.
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "/gluetun-entrypoint", "healthcheck"]
      interval: 30s
      timeout: 10s
      retries: 3

  # --- Download Client ---
  qbittorrent:
    image: lscr.io/linuxserver/qbittorrent:latest
    container_name: qbittorrent
    network_mode: "service:gluetun"
    depends_on:
      gluetun:
        condition: service_healthy
    environment:
      - PUID=1000
      - PGID=1000
      - TZ=<YOUR_TIMEZONE>
      - WEBUI_PORT=8080
    volumes:
      - ./qbittorrent/config:/config
      - /data/torrents:/data/torrents
    restart: unless-stopped

  # --- Indexer Manager (through VPN) ---
  prowlarr:
    image: lscr.io/linuxserver/prowlarr:latest
    container_name: prowlarr
    network_mode: "service:gluetun"
    depends_on:
      gluetun:
        condition: service_healthy
    environment:
      - PUID=1000
      - PGID=1000
      - TZ=<YOUR_TIMEZONE>
    volumes:
      - ./prowlarr/config:/config
    restart: unless-stopped

  # --- TV Show Management ---
  sonarr:
    image: lscr.io/linuxserver/sonarr:latest
    container_name: sonarr
    environment:
      - PUID=1000
      - PGID=1000
      - TZ=<YOUR_TIMEZONE>
    ports:
      - 8989:8989
    volumes:
      - ./sonarr/config:/config
      - /data:/data
    restart: unless-stopped

  # --- Movie Management ---
  radarr:
    image: lscr.io/linuxserver/radarr:latest
    container_name: radarr
    environment:
      - PUID=1000
      - PGID=1000
      - TZ=<YOUR_TIMEZONE>
    ports:
      - 7878:7878
    volumes:
      - ./radarr/config:/config
      - /data:/data
    restart: unless-stopped

  # --- Subtitle Management ---
  bazarr:
    image: lscr.io/linuxserver/bazarr:latest
    container_name: bazarr
    environment:
      - PUID=1000
      - PGID=1000
      - TZ=<YOUR_TIMEZONE>
    ports:
      - 6767:6767
    volumes:
      - ./bazarr/config:/config
      - /data/media:/data/media
    restart: unless-stopped

  # --- CloudFlare Bypass Proxy ---
  # Required for indexers protected by CloudFlare (e.g. 1337x)
  # Must run behind Gluetun so CF cookies are tied to the same VPN IP as Prowlarr
  flaresolverr:
    image: ghcr.io/flaresolverr/flaresolverr:latest
    container_name: flaresolverr
    network_mode: "service:gluetun"
    depends_on:
      gluetun:
        condition: service_healthy
    environment:
      - LOG_LEVEL=info
      - TZ=<YOUR_TIMEZONE>
    restart: unless-stopped

  # --- Media Request Portal ---
  jellyseerr:
    image: fallenbagel/jellyseerr:latest
    container_name: jellyseerr
    environment:
      - TZ=<YOUR_TIMEZONE>
    ports:
      - 5055:5055
    volumes:
      - ./jellyseerr/config:/app/config
    restart: unless-stopped
```

**IMPORTANT:** Replace `<YOUR_TIMEZONE>` with your timezone in every container (e.g., `America/Chicago`, `America/New_York`, `America/Denver`, `America/Los_Angeles`).

**Why containers are mounted this way:**
- qBittorrent only needs `/data/torrents` (it only writes downloads)
- Sonarr and Radarr need `/data` (the full parent) so they can see BOTH `/data/torrents` (where downloads land) and `/data/media` (where they hardlink to). This is what makes hardlinks work.
- Bazarr only needs `/data/media` (it adds subtitles to existing media files)
- Jellyseerr needs no media access (it only talks to APIs)

### 3.6 Gluetun / AirVPN Setup (WireGuard)

Gluetun connects to AirVPN using WireGuard. You need to generate WireGuard credentials AND request a forwarded port from your AirVPN account.

**Generate WireGuard keys from AirVPN:**

1. Log into your AirVPN account
2. Go to Client Area > WireGuard Keys (or Devices)
3. Generate a new WireGuard key pair if you do not have one already
4. AirVPN will provide you with:
   - **Private Key** - your WireGuard private key
   - **Preshared Key** - additional layer of security (AirVPN provides this)
   - **Address** - your assigned WireGuard IP (e.g., `10.128.x.x/32`)

**Request a forwarded port from AirVPN:**

1. Client Area > Ports > Manage
2. Request a new port - AirVPN assigns you a port number (e.g. `51234`)
3. Note this number - you will use it in the docker-compose.yml (`FIREWALL_VPN_INPUT_PORTS`) and in qBittorrent's listening port setting

Without a forwarded port, qBittorrent cannot accept inbound peer connections. You will only connect to peers that you reach out to first, which dramatically reduces the number of available peers and download speeds.

**Update the docker-compose.yml environment variables:**

Replace the placeholder values in the Gluetun service:
```
WIREGUARD_PRIVATE_KEY=<your private key from AirVPN>
WIREGUARD_PRESHARED_KEY=<your preshared key from AirVPN>
WIREGUARD_ADDRESSES=<your assigned WireGuard IP, e.g., 10.128.0.2/32>
SERVER_COUNTRIES=<pick a country, e.g., Netherlands, Switzerland, etc.>
```

**Why WireGuard over OpenVPN:**
- Lower CPU overhead (important since this VM only has 4 cores shared with the arr stack)
- Faster connection establishment
- Better throughput for large downloads
- Simpler configuration (no .ovpn files to manage)

**Note:** This does NOT conflict with your personal WireGuard VPN for connecting back to your LAN. That tunnel runs on a completely different host, interface, and port. They are independent.

**Note on Gluetun + AirVPN:** Gluetun's AirVPN integration evolves over time. If the environment variable approach above does not work, check the Gluetun wiki for the current method: https://github.com/qdm12/gluetun-wiki/blob/main/setup/providers/airvpn.md

### 3.7 Start the Stack

```bash
cd /opt/media-stack
docker compose up -d

# Check all containers are running
docker compose ps

# Check Gluetun VPN is connected
docker logs gluetun
# Look for "healthy" or "connected" messages

# Verify VPN is working (should show AirVPN IP, not your real IP)
docker exec gluetun wget -qO- https://ipinfo.io
```

If any container fails, check logs: `docker logs <container_name>`

---

## Phase 4: Traefik VM (10.0.40.10)

### 4.1 VM Creation in Proxmox

1. Create a new VM:
   - **Name:** traefik
   - **OS:** Ubuntu Server 24.04 LTS
   - **CPU:** 2 cores
   - **RAM:** 2048 MB (2 GB)
   - **Disk:** 16 GB
   - **Network:**
     - Bridge: `vmbr1`
     - VLAN Tag: `40`
     - Model: VirtIO

2. Install Ubuntu Server, configure static IP via netplan:

```yaml
network:
  version: 2
  ethernets:
    ens18:
      dhcp4: false
      addresses:
        - 10.0.40.10/24
      routes:
        - to: default
          via: 10.0.40.1
      nameservers:
        addresses:
          - 1.1.1.1
          - 8.8.8.8
```

3. Install Docker (same steps as Phase 3.3)

### 4.2 Traefik Setup

```bash
sudo mkdir -p /opt/traefik
cd /opt/traefik
```

Create `/opt/traefik/docker-compose.yml`:

```yaml
services:
  traefik:
    image: traefik:latest
    container_name: traefik
    restart: unless-stopped
    security_opt:
      - no-new-privileges:true
    ports:
      - "80:80"
      - "443:443"
      - "8080:8080"  # Dashboard (internal access only)
    volumes:
      - /etc/localtime:/etc/localtime:ro
      - ./traefik.yml:/traefik.yml:ro
      - ./dynamic.yml:/dynamic.yml:ro
      - ./acme.json:/acme.json
    environment:
      - PORKBUN_API_KEY=${PORKBUN_API_KEY}
      - PORKBUN_SECRET_API_KEY=${PORKBUN_SECRET_API_KEY}

  ddns-updater:
    image: qmcgaw/ddns-updater
    container_name: ddns-updater
    restart: unless-stopped
    volumes:
      - ./ddns-updater:/updater/data
    ports:
      - "8000:8000"  # Web UI for DDNS status (internal only)
```

Create `/opt/traefik/.env`:
```
PORKBUN_API_KEY=<YOUR_PORKBUN_API_KEY>
PORKBUN_SECRET_API_KEY=<YOUR_PORKBUN_SECRET_KEY>
```

Get your API keys from Porkbun: Account > API Access > Create API Key.

Create `/opt/traefik/traefik.yml` (static configuration):

```yaml
api:
  dashboard: true
  insecure: true
  # Dashboard served on :8080, no auth needed since it is
  # only accessible from VLAN 40 (internal / VPN in)

entryPoints:
  web:
    address: ":80"
    http:
      redirections:
        entryPoint:
          to: websecure
          scheme: https
  websecure:
    address: ":443"

providers:
  file:
    filename: /dynamic.yml
    watch: true

certificateResolvers:
  letsencrypt:
    acme:
      email: your-email@example.com
      storage: /acme.json
      dnsChallenge:
        provider: porkbun
        resolvers:
          - "1.1.1.1:53"
          - "8.8.8.8:53"

log:
  level: INFO
```

Create `/opt/traefik/dynamic.yml` (routing configuration):

```yaml
http:
  routers:
    jellyfin:
      rule: "Host(`jellyfin.ethanlawcorn.com`)"
      entryPoints:
        - websecure
      service: jellyfin
      tls:
        certResolver: letsencrypt

    jellyseerr:
      rule: "Host(`requests.ethanlawcorn.com`)"
      entryPoints:
        - websecure
      service: jellyseerr
      tls:
        certResolver: letsencrypt

  services:
    jellyfin:
      loadBalancer:
        servers:
          - url: "http://10.0.45.10:8096"

    jellyseerr:
      loadBalancer:
        servers:
          - url: "http://10.0.45.20:5055"
```

**Why file provider instead of Docker labels?** Traefik is on a different host (VLAN 40) than the backend services (VLAN 45). Docker labels only work for containers on the same Docker host. The file provider lets Traefik route to any IP address on the network.

### 4.3 DDNS Updater Configuration

Create `/opt/traefik/ddns-updater/config.json`:

```json
{
  "settings": [
    {
      "provider": "porkbun",
      "domain": "ethanlawcorn.com",
      "host": "@",
      "api_key": "<YOUR_PORKBUN_API_KEY>",
      "secret_api_key": "<YOUR_PORKBUN_SECRET_KEY>",
      "ip_version": "ipv4"
    },
    {
      "provider": "porkbun",
      "domain": "ethanlawcorn.com",
      "host": "jellyfin",
      "api_key": "<YOUR_PORKBUN_API_KEY>",
      "secret_api_key": "<YOUR_PORKBUN_SECRET_KEY>",
      "ip_version": "ipv4"
    },
    {
      "provider": "porkbun",
      "domain": "ethanlawcorn.com",
      "host": "requests",
      "api_key": "<YOUR_PORKBUN_API_KEY>",
      "secret_api_key": "<YOUR_PORKBUN_SECRET_KEY>",
      "ip_version": "ipv4"
    }
  ]
}
```

This container automatically detects your public IP and updates all three DNS records (root, jellyfin, requests) whenever it changes.

### 4.4 SSL Certificate Setup and Launch

```bash
cd /opt/traefik

# Create acme.json with correct permissions (Let's Encrypt stores certs here)
touch acme.json
chmod 600 acme.json

# Start Traefik
docker compose up -d

# Watch logs for certificate issuance
docker logs -f traefik
# Look for "certificate obtained successfully" messages
```

---

## Phase 5: DNS Configuration (Porkbun)

### 5.1 DNS Records

Log into Porkbun and add these A records for ethanlawcorn.com:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | @ | Your public IP | 600 |
| A | jellyfin | Your public IP | 600 |
| A | requests | Your public IP | 600 |

All three point to the same public IP. Traefik handles routing based on the hostname in the HTTP request. Using TTL 600 (10 minutes) so DDNS updates propagate quickly.

**Find your public IP:** From any device on your network: `curl ifconfig.me`

The DDNS updater container (Phase 4.3) will keep these records updated automatically when your IP changes.

### 5.2 Verify DNS Propagation

After adding records, wait a few minutes then verify:

```bash
# From any machine
nslookup jellyfin.ethanlawcorn.com
nslookup requests.ethanlawcorn.com

# Both should resolve to your public IP
```

---

## Phase 6: Service Configuration

At this point, all infrastructure is running. Now we connect the services together.

### 6.1 qBittorrent Initial Setup

Access at `http://10.0.45.20:8080` (internal only, VPN in if remote).

Default credentials are usually `admin` / `adminadmin` (check container logs for temp password: `docker logs qbittorrent`).

**Settings to configure:**
- Downloads > Default Save Path: `/data/torrents/complete`
- Downloads > Keep incomplete torrents in: `/data/torrents/incomplete` (enable this)
- Connection > Listening Port: set to your AirVPN forwarded port number
- Connection > Uncheck "Use UPnP / NAT-PMP port forwarding from my router"
- Speed > Set upload/download limits if desired
- Web UI > Change default password immediately

### 6.2 Prowlarr Setup

Access at `http://10.0.45.20:9696` (internal only).

1. Set authentication on first access (Settings > General > Authentication)
2. Add FlareSolverr proxy (Settings > Indexers > Indexer Proxies > Add):
   - Type: FlareSolverr
   - URL: `http://localhost:8191`
     (localhost works because FlareSolverr shares Gluetun's network namespace)
   - Add a tag, e.g. `flaresolverr`
   - Test - should succeed
3. Add indexers (Settings > Indexers > Add):
   - Click the `+` and browse public tracker indexers
   - Add a few popular ones (1337x, RARBG alternatives, etc.)
   - For any indexer that uses CloudFlare protection (e.g. 1337x), assign the `flaresolverr` tag in the indexer settings
   - Test each indexer after adding
4. Add applications (Settings > Apps > Add):
   - **Sonarr:**
     - Prowlarr Server: `http://gluetun:9696`
     - Sonarr Server: `http://sonarr:8989`
     - API Key: (copy from Sonarr > Settings > General > API Key)
   - **Radarr:**
     - Prowlarr Server: `http://gluetun:9696`
     - Radarr Server: `http://radarr:7878`
     - API Key: (copy from Radarr > Settings > General > API Key)

After adding apps, Prowlarr automatically pushes indexer configurations to Sonarr and Radarr.

### 6.3 Sonarr Setup

Access at `http://10.0.45.20:8989` (internal only).

1. Add download client (Settings > Download Clients > Add > qBittorrent):
   - Host: `gluetun`
   - Port: `8080`
   - Username/Password: your qBittorrent credentials
   - Category: `tv` (keeps downloads organized)
   - Test connection

2. Add root folder (Settings > Media Management > Root Folders > Add):
   - Path: `/data/media/tv`

3. Media Management settings:
   - Enable "Rename Episodes"
   - Enable "Use Hardlinks instead of Copy" (should be default)
   - Set your preferred naming format

### 6.4 Radarr Setup

Access at `http://10.0.45.20:7878` (internal only).

1. Add download client (Settings > Download Clients > Add > qBittorrent):
   - Host: `gluetun`
   - Port: `8080`
   - Username/Password: your qBittorrent credentials
   - Category: `movies`
   - Test connection

2. Add root folder (Settings > Media Management > Root Folders > Add):
   - Path: `/data/media/movies`

3. Media Management settings:
   - Enable "Rename Movies"
   - Enable "Use Hardlinks instead of Copy"
   - Set your preferred naming format

### 6.5 Bazarr Setup

Access at `http://10.0.45.20:6767` (internal only).

1. Settings > Sonarr:
   - Host: `sonarr`
   - Port: `8989`
   - API Key: (from Sonarr)

2. Settings > Radarr:
   - Host: `radarr`
   - Port: `7878`
   - API Key: (from Radarr)

3. Settings > Subtitles:
   - Add subtitle providers (OpenSubtitles is common, requires free account)
   - Configure languages you want

### 6.6 Jellyfin User Accounts

Access at `http://10.0.45.10:8096`.

Create accounts for family members:
- Each person gets their own account
- Set strong passwords (4 randomly generated words per your preference)
- You can restrict library access per user if needed
- Enable remote access: Dashboard > Networking > Allow remote connections

### 6.7 Jellyseerr Setup

Access at `http://10.0.45.20:5055` (internal only for setup).

1. First-run wizard:
   - Select "Jellyfin" as your media server
   - Jellyfin URL: `http://10.0.45.10:8096`
   - Sign in with your Jellyfin admin account
   - Sync libraries (Movies, TV Shows)

2. Add Sonarr:
   - Server Name: Sonarr
   - Hostname: `sonarr`
   - Port: `8989`
   - API Key: (from Sonarr)
   - Root Folder: `/data/media/tv`
   - Quality Profile: select your preference

3. Add Radarr:
   - Server Name: Radarr
   - Hostname: `radarr`
   - Port: `7878`
   - API Key: (from Radarr)
   - Root Folder: `/data/media/movies`
   - Quality Profile: select your preference

4. User settings:
   - Enable "Use Jellyfin Users" so family members log in with their Jellyfin credentials
   - Set default request limits if desired (e.g., 10 movies per week)

---

## Phase 7: Testing Checklist

### Internal Tests (VPN into your network)

- [ ] qBittorrent WebUI loads at `http://10.0.45.20:8080`
- [ ] VPN is active: `docker exec gluetun wget -qO- https://ipinfo.io` shows AirVPN IP
- [ ] Prowlarr can search indexers at `http://10.0.45.20:9696`
- [ ] Sonarr/Radarr can connect to qBittorrent and Prowlarr
- [ ] Test download: search for and download a small file via Radarr
- [ ] Verify file lands in `/data/torrents/complete/` on TrueNAS
- [ ] Verify Radarr imports (hardlinks) to `/data/media/movies/`
- [ ] Jellyfin detects and plays the new media
- [ ] Jellyseerr shows synced libraries from Jellyfin
- [ ] Traefik dashboard loads at `http://10.0.40.10:8080`

### External Tests (from outside your network, e.g., phone on cellular)

- [ ] `https://jellyfin.ethanlawcorn.com` loads with valid SSL certificate
- [ ] Can log in with a Jellyfin user account
- [ ] Can play media (verify transcoding works if needed)
- [ ] `https://requests.ethanlawcorn.com` loads with valid SSL certificate
- [ ] Can log in with Jellyfin credentials
- [ ] Can submit a media request
- [ ] Request flows through to Sonarr/Radarr and starts downloading

### Security Tests

- [ ] From VLAN 45, cannot ping 10.0.10.x (management)
- [ ] From VLAN 40, cannot ping 10.0.10.x (management)
- [ ] Traefik only routes configured hostnames (random subdomain returns 404)
- [ ] HTTP redirects to HTTPS
- [ ] qBittorrent and arr stack WebUIs are NOT accessible from the internet

---

## Weak Points and Risks

### Architecture

1. **Single point of failure:** Traefik VM goes down = no external access. Acceptable for a homelab; you are not running a business. If it matters, a cron job health check with email alerts is easy to set up later.

2. **Router-on-a-stick latency:** All inter-VLAN traffic (Traefik to backends) traverses the full switch path to OPNsense and back. For media streaming this is negligible, but worth understanding.

3. **AT&T BGW320 IP passthrough:** Known to be occasionally flaky. If it resets, your public services go down until you reconfigure it. Consider bookmarking the BGW320 admin page and documenting your passthrough settings.

### Security

4. **Internet-exposed services:** Jellyfin and Jellyseerr are exposed to the internet. Both have authentication, but any public-facing service is an attack surface. Keep them updated. Jellyfin's built-in auth is sufficient for family use with strong passwords - adding Authelia/Authentik would be overkill for your use case and would complicate the setup for family members.

5. **No intrusion detection:** Consider adding fail2ban or CrowdSec on the Traefik VM later to block brute-force login attempts against Jellyfin/Jellyseerr.

6. **VPN kill switch:** Gluetun has a built-in kill switch (enabled by default). If the VPN drops, qBittorrent cannot reach the internet. Verify this is working: `docker exec qbittorrent wget -qO- https://ipinfo.io` should fail when VPN is down.

### Storage

7. **No backup strategy:** Your arr stack configs (Sonarr/Radarr databases, Prowlarr indexer configs) and Jellyfin metadata live on container volumes. If the Docker VM dies, you lose all configuration. Consider periodic backup of `/opt/media-stack/` to TrueNAS.

8. **raidz2 is not a backup:** raidz2 protects against drive failure (up to 2 drives), NOT against accidental deletion, ransomware, or pool corruption. Media is replaceable (re-download), but Jellyfin watch history and user data on the `fast` pool NVMe is NOT protected by any redundancy. Consider periodic snapshots.

### Operational

9. **Dynamic DNS lag:** When your ISP changes your IP, there is a brief window (up to TTL duration, ~10 minutes with our config) where DNS points to the old IP. Family members will see a connection error until propagation completes.

10. **TrueNAS app updates:** TrueNAS Scale's app management can require manual intervention during major updates. Pin Jellyfin to a known-good version and update deliberately, not automatically.

---

## Maintenance Notes

**Regular tasks:**
- Check for container image updates monthly: `docker compose pull && docker compose up -d`
- Monitor disk usage on TrueNAS pools
- Review Traefik access logs for suspicious activity
- Renew AirVPN subscription before it expires
- Verify SSL cert auto-renewal is working (certs renew every ~60 days)

**Useful commands on Media Docker VM:**
```bash
# View all container status
docker compose -f /opt/media-stack/docker-compose.yml ps

# View logs for a specific container
docker logs --tail 50 sonarr

# Restart a specific container
docker compose -f /opt/media-stack/docker-compose.yml restart sonarr

# Update all containers
cd /opt/media-stack && docker compose pull && docker compose up -d

# Check VPN status
docker exec gluetun wget -qO- https://ipinfo.io

# Check NFS mount
df -h /data
```

**Useful commands on Traefik VM:**
```bash
# Check Traefik routing
docker logs traefik | grep "router"

# Check SSL certificate status
docker logs traefik | grep "certificate"

# Check DDNS status
docker logs ddns-updater
```

---

## Implementation Order Summary

1. Phase 1: Network (VLANs, firewall rules, verify connectivity)
2. Phase 2: TrueNAS (datasets, NFS, iGPU, Jellyfin)
3. Phase 3: Media Docker VM (VM, Docker, NFS mount, compose stack)
4. Phase 4: Traefik VM (VM, Docker, Traefik, DDNS)
5. Phase 5: DNS records on Porkbun
6. Phase 6: Connect all services together
7. Phase 7: Test everything

Work through each phase completely before moving to the next. If something in an earlier phase is broken, everything after it will fail.
