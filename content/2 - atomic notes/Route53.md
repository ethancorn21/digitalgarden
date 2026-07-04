2026-06-29 17:14
status: #baby
tags: [[SAA-C03]]; [[technology]]

---
# Route53

AWS service that allows you to register domains and host zone files (all of the DNS info for a particular domain).

Global service. Globally resilient.

One zone file usually gets put onto 4 name servers, this zone is aka a hosted zone. Route53 then talks with the top level domain (TLD) (.org, .com, .net, etc.) to put that zone file into the top level domain registry with name server (NS) records.

Simplified:
Create zone file, put it onto servers, liaison with the TLD registry to get name server records to point back to those servers.

## Zones

essentially DNS as a server

servers with the zone file on them = hosted zone.

can be private or public:
- private zones hosted on private VPCs


DNS Zones = database where DNS records are stored

Every new hosted zone = 4 different NS to host that zone.



---
## see also:

