# Fixing DNS Issues in My Media Server Stack
[[homelab]], [[Media Server Project]]

## Background

My home media stack runs behind a Traefik reverse proxy on a DMZ VM (`10.0.40.10`). Jellyfin and Jellyseerr are hosted on backend VMs in a separate VLAN, exposed to the internet via dynamic DNS and OPNsense NAT. The rough path a request takes looks like this:

```
Client → DNS → Public IP → BGW320 (IP passthrough) → OPNsense → Traefik VM → Backend
```

At some point I moved `ethanlawcorn.com` to Cloudflare nameservers for my personal website. I didn't think much of it at the time — but it quietly broke two things that took months to surface.

---

## The Problem

`jellyfin.ethanlawcorn.com` and `requests.ethanlawcorn.com` stopped responding entirely. `curl` returned `Could not resolve host`. `dig` returned nothing.

---

## Diagnosis

**Step 1: Check DNS**

```bash
dig jellyfin.ethanlawcorn.com +short
# (no output)

curl -s ifconfig.me
# returned IPv6 address
```

DNS records weren't resolving at all — not a wrong IP, just nothing. That pointed to either deleted records or a nameserver mismatch.

**Step 2: Check the DDNS updater**

The `ddns-updater` container on the Traefik VM was marked **unhealthy** and its logs had stopped updating in mid-March — about two months of silence. The container was running but effectively dead.

```
2026-03-19T14:16:56Z INFO obtaining ipv4 address succeeded after 1 failed try
(nothing after this)
```

**Root cause identified:** When I switched `ethanlawcorn.com` to Cloudflare nameservers, Porkbun was no longer authoritative. The DDNS updater was still writing A records to Porkbun — records that Cloudflare (the actual authoritative nameserver) had no knowledge of. Over time, the Cloudflare records either expired or were never present. The result: `dig` returns nothing.

There was also a second problem lurking: Traefik's Let's Encrypt integration was using Porkbun's API to complete DNS challenges for cert renewal. With Cloudflare now authoritative, it couldn't create `_acme-challenge` TXT records, so every renewal had been failing since early May. The cert expired May 11.

---

## The Fix

### Part 1 — Restore DNS records immediately

Logged into Cloudflare, added A records manually for `jellyfin` and `requests` pointing to my current public IP. Set proxy status to **DNS only** (grey cloud) since Traefik handles TLS.

### Part 2 — Migrate ddns-updater from Porkbun to Cloudflare

Created a Cloudflare API token scoped to `Zone:DNS:Edit` for `ethanlawcorn.com` only. Updated `/opt/traefik/ddns-updater/config.json`:

```json
{"settings":[
  {"provider":"cloudflare","zone_identifier":"<zone-id>","token":"<token>","domain":"ethanlawcorn.com","host":"jellyfin","ip_version":"ipv4","proxied":false,"ttl":1},
  {"provider":"cloudflare","zone_identifier":"<zone-id>","token":"<token>","domain":"ethanlawcorn.com","host":"requests","ip_version":"ipv4","proxied":false,"ttl":1}
]}
```

Note: the Cloudflare provider requires a `ttl` field — omitting it causes a validation error on startup.

Restarted the container. The web UI at `:8000` confirmed both records updated successfully.

### Part 3 — Fix Traefik's ACME / Let's Encrypt cert renewal

Traefik's ACME config in `traefik.yml` was still using `provider: porkbun` for DNS challenges. Updated to Cloudflare:

```yaml
certificatesResolvers:
  letsencrypt:
    acme:
      email: ethancorn@ethanlawcorn.com
      storage: /acme.json
      dnsChallenge:
        provider: cloudflare
        resolvers:
          - "1.1.1.1:53"
          - "8.8.8.8:53"
```

Traefik's Cloudflare provider reads credentials from environment variables. Updated `.env`:

```
CLOUDFLARE_DNS_API_TOKEN=<token>
CLOUDFLARE_ZONE_API_TOKEN=<token>
```

And `docker-compose.yaml`:

```yaml
environment:
  - CLOUDFLARE_DNS_API_TOKEN=${CLOUDFLARE_DNS_API_TOKEN}
  - CLOUDFLARE_ZONE_API_TOKEN=${CLOUDFLARE_ZONE_API_TOKEN}
```

Deleted the old (expired) `acme.json`, set correct permissions (`chmod 600`), and restarted Traefik. The ACME provider registered with Let's Encrypt and began issuing new certificates.

---

## Issues Encountered Along the Way

- **ddns-updater Cloudflare config requires `ttl` field** — not obvious from docs, causes silent validation failure on startup
- **acme.json had become a directory** somehow, causing Docker volume mount failures; had to remove and recreate as a file with `touch` and `chmod 600`
- **Wrong Cloudflare env var names** — used `CF_API_TOKEN` initially, but Traefik's lego library expects `CLOUDFLARE_DNS_API_TOKEN` and `CLOUDFLARE_ZONE_API_TOKEN`
- **YAML indentation errors** in `traefik.yml` and `docker-compose.yaml` from manual edits via vim over SSH

---

## Lessons

Moving a domain to a new DNS provider isn't just a nameserver change — it breaks anything that was writing records to the old provider. In my case that was both the DDNS updater and the ACME DNS challenge. Neither failed loudly; they both just silently stopped working until something expired.

Going forward, the Cloudflare API token handles both record management (via ddns-updater) and cert renewal (via Traefik), so a future nameserver change would only require updating credentials in two config files.
