# Fixing DNS Issues in Media Server Stack
[[homelab]], [[Media Server Project]]
*AI generated*
## Background

The home media stack runs behind a Traefik reverse proxy on a DMZ VM (`10.0.40.10`). Jellyfin and Jellyseerr are hosted on backend VMs in a separate VLAN, exposed to the internet via dynamic DNS and OPNsense NAT. Request path:

```
Client → DNS → Public IP → BGW320 (IP passthrough) → OPNsense → Traefik VM → Backend
```

At some point `ethanlawcorn.com` was moved to Cloudflare nameservers for the personal website.

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

**Root cause:** When `ethanlawcorn.com` was switched to Cloudflare nameservers, Porkbun was no longer authoritative. The DDNS updater was still writing A records to Porkbun — records that Cloudflare (the actual authoritative nameserver) had no knowledge of. Over time, the Cloudflare records either expired or were never present. The result: `dig` returns nothing.

A second problem was also present: Traefik's Let's Encrypt integration was using Porkbun's API to complete DNS challenges for cert renewal. With Cloudflare now authoritative, `_acme-challenge` TXT records couldn't be created, so every renewal had been failing since early May. The cert expired May 11.

---

## The Fix

### Part 1 — Restore DNS records immediately

In Cloudflare, A records were manually added for `jellyfin` and `requests` pointing to the current public IP. Proxy status set to **DNS only** (grey cloud) since Traefik handles TLS.

### Part 2 — Migrate ddns-updater from Porkbun to Cloudflare

A Cloudflare API token was created scoped to `Zone:DNS:Edit` for `ethanlawcorn.com` only. Updated `/opt/traefik/ddns-updater/config.json`:

```json
{"settings":[
  {"provider":"cloudflare","zone_identifier":"<zone-id>","token":"<token>","domain":"ethanlawcorn.com","host":"jellyfin","ip_version":"ipv4","proxied":false,"ttl":1},
  {"provider":"cloudflare","zone_identifier":"<zone-id>","token":"<token>","domain":"ethanlawcorn.com","host":"requests","ip_version":"ipv4","proxied":false,"ttl":1}
]}
```

Note: the Cloudflare provider requires a `ttl` field — omitting it causes a validation error on startup.

Container restarted. The web UI at `:8000` confirmed both records updated successfully.

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

Old (expired) `acme.json` deleted, correct permissions set (`chmod 600`), Traefik restarted. The ACME provider registered with Let's Encrypt and began issuing new certificates.

---

## Issues Encountered Along the Way

- **ddns-updater Cloudflare config requires `ttl` field** — not obvious from docs, causes silent validation failure on startup
- **acme.json had become a directory** somehow, causing Docker volume mount failures; had to remove and recreate as a file with `touch` and `chmod 600`
- **Wrong Cloudflare env var names** — `CF_API_TOKEN` used initially, but Traefik's lego library expects `CLOUDFLARE_DNS_API_TOKEN` and `CLOUDFLARE_ZONE_API_TOKEN`
- **YAML indentation errors** in `traefik.yml` and `docker-compose.yaml` from manual edits via vim over SSH

---

## Lessons

Moving a domain to a new DNS provider isn't just a nameserver change — it breaks anything writing records to the old provider. In this case that was both the DDNS updater and the ACME DNS challenge. Neither failed loudly; both silently stopped working until something expired.

The Cloudflare API token now handles both record management (via ddns-updater) and cert renewal (via Traefik), so a future nameserver change would only require updating credentials in two config files.
