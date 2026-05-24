# Homelab Backup Automation

[[homelab]]
*AI generated*

2026-05-23

## Overview

Two backup systems were set up: automated Cisco switch config backups via Python/Netmiko, and Proxmox VM snapshots shipped to TrueNAS over NFS.

## Part 1: Switch Config Backups (Python + Netmiko)

Built [`backup_switch_config.py`](https://github.com/ethancorn21/automation/blob/main/backup_switch_config.py) that:
- SSHs into DSW1 (10.0.99.1) and ASW1 (10.0.99.2) using Netmiko
- Runs `show running-config` on each
- Saves output to `./backups/YYYY-MM-DD/<hostname>.txt`

Key implementation details:
- Device inventory as a Python list of dicts — one dict per switch, looped with `ConnectHandler(**device)`
- `hostname` key popped from dict before unpacking to Netmiko (Netmiko doesn't accept unknown keys)
- Credentials in `.env`, loaded with `python-dotenv`
- Directory created with `os.makedirs(path, exist_ok=True)` before writing
- Dedicated read-only user `netauto` at privilege 1 created on both switches

Deployment:
- Cloned to `/opt/automation` on automation VM (Ubuntu 24.04, 10.0.20.53, VLAN 20)
- Venv at `/opt/automation/.venv`, dependencies installed via `requirements.txt`
- Cron job: `0 0 * * 0 /opt/automation/.venv/bin/python /opt/automation/backup_switch_config.py` (every Sunday @ midnight)

## Part 2: Proxmox VM Backups to TrueNAS

### TrueNAS Dataset
- Pool: `fast` (1TB NVMe)
- Dataset: `proxmox-backups`
- Compression: ZSTD
- Quota: 500 GiB
- No encryption (TrueNAS not directly internet-exposed)

### NFS Share
- Path: `/mnt/fast/proxmox-backups`
- Protocol: NFSv4 only
- Restricted to `10.0.99.0/24`
- Maproot user: root

### OPNsense Firewall Rule
- Interface: LAN (transit, VLAN 2, 10.0.2.1/30)
- Protocol: TCP
- Source: `10.0.99.10/32` (Proxmox, SRV1)
- Destination: `10.0.45.10/32` (TrueNAS, SRV2)
- Destination port: 2049

### Proxmox Storage
- Added as NFS storage: ID `truenas-backups`, NFSv4, content type VZDump only
- Backup job: Snapshot mode, ZSTD compression, keep last 10, runs Sunday 2am

### Troubleshooting — Key Issue
Proxmox had an IP assigned to `vmbr45` (the VM bridge for VLAN 45). This caused Proxmox to think 10.0.45.0/24 was a local subnet and try to reach TrueNAS directly instead of routing through DSW1 → OPNsense. Traffic never hit the firewall.

Fix: removed the IP from `vmbr45` in Proxmox GUI (Node > System > Network > vmbr45 > Edit, clear IPv4/CIDR). VMs on the bridge were unaffected — they use their own IPs, not the bridge IP.

After fix, routing worked correctly: Proxmox → DSW1 (default route 10.0.2.1) → OPNsense → VLAN 45 → TrueNAS.
