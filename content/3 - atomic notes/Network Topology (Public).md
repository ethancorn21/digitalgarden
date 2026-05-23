# Homelab Network Topology

> AI generated from live switch/router output. May not reflect latest changes.

---

## Physical Diagram

```
INTERNET
    |
AT&T BGW320 (IP Passthrough)
    |
OPNsense (Dedicated Hardware)
    | 10.0.2.0/30 routed P2P link
DSW1 - Cisco 2960X (Distribution)
    | fiber trunk
ASW1 - Cisco 2960X (Access)
    |
  hosts
```

---

## Routing Design

DSW1 handles inter-VLAN routing for trusted VLANs (Personal, Servers, Untrusted, Management) via SVIs.
OPNsense handles routing for DMZ and Outface VLANs, enforcing firewall rules on that traffic.

Default route on DSW1 points to OPNsense. OPNsense routes internal traffic back via a static summary route through DSW1.

---

## VLANs

| VLAN | Name | Subnet | Routed by |
|------|------|--------|-----------|
| 2 | Transit | 10.0.2.0/30 | — |
| 10 | Personal | 10.0.10.0/24 | DSW1 |
| 20 | Servers | 10.0.20.0/24 | DSW1 |
| 30 | Untrusted | 10.0.30.0/24 | DSW1 |
| 40 | DMZ | 10.0.40.0/24 | OPNsense |
| 45 | Outface | 10.0.45.0/24 | OPNsense |
| 99 | Management | 10.0.99.0/24 | DSW1 |

---

## Devices

| Device | Role | VLAN | OS |
|--------|------|------|----|
| OPNsense | WAN firewall / gateway | Transit | OPNsense |
| DSW1 | Distribution switch, L3, DHCP server | Management | Cisco IOS |
| ASW1 | Access switch | Management | Cisco IOS |
| SRV1 | Hypervisor | Management | Proxmox |
| SRV2 | NAS | Outface | TrueNAS Scale |
| Unifi Controller | Network management | Management | Unifi |

---

## Key Trunk Links

| Link | Native VLAN | Allowed VLANs |
|------|-------------|---------------|
| DSW1 → OPNsense | Transit | Transit, DMZ, Outface, Management |
| DSW1 → ASW1 | (isolated) | Personal, Servers, Untrusted, DMZ, Outface, Management |

---

## DHCP

DSW1 serves DHCP for all VLANs. OPNsense acts as relay target.
