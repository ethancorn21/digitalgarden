2026-06-29 17:37
status: #baby
tags: [[SAA-C03]]; [[technology]]

---
# DNS Record Types

## nameserver (NS)
- point to where the master registry of specific IPs are (nameservers)
- Remember DNS uses recursive resolving to find the authoritative dns server
	- *starts at TLD* -> "idk check here" -> asks -> "idk check here" -> I know

## A and AAAA records
- map hostname to IP address: IPv4 and IPv6

## CNAME
- allows the creation of DNS shortcuts - host to host records
- one server can have multiple CNAMES which resolve to other DNS records
- can't resolve to IP only named records
## MX
- email exchange
- resolves much like A records. SMTP to specified IP

## TXT Record
- adds txt to a domain, can be used to prove authorization

## DNS TTL
- how fast a DNS Request dies out after being sent. "Give up after this many seconds of not being resolved"
- A resolver server will hold the DNS record for the specified TTL
	- DNS record is authoritative from the resolver server.
- when planning to change records, change TTL value to 60 seconds weeks in advance.





---
## see also:

