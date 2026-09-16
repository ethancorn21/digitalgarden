2026-09-01 16:06
status: #baby
tags: [[technology]]; [[sec+]]

---
# Zero Trust

No user, device, or process is implicitly trusted. For everything there has to be AAA.

Break up security into two planes:
- data plane - things like NAT, frames & packets, encryption, etc.
- control plane - policies, rules, how data plane is controlled.

Adaptive Identity
- consider the identity of the individual basis
	- are they compromised, is there device trusted, where are they, etc.
	- if suspicious dynamically make authentication stricter
Limit Entry Points
- like Cyolo

Policy driven access control
- combine adaptive identity with predefined rules
	- "if this person is logging in from China and is using a new device, lock out"
Policy Enforcement Point & Policy Decision Point
- PDP - allow or disallow traffic on the network
- all traffic must pass through the PEP
- PEP is the middle ground between your resources and the system (users/processes/devices).
- PEP gathers all of the data and passes it to PDP which makes the decision to allow or disallow.


---
## see also:

