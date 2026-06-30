2026-06-15 17:18
status: #baby
tags: [[SAA-C03]]; [[technology]]

---
# Public vs Private Services

AWS public or private service - networking perspective

'public' internet zone:
- internet service zone - thinking Gmail, YouTube, Steam, etc.

'aws private' zone:
VPC - virtual private cloud
- think of this as your private network inside AWS
- AWS SDN
- nothing can reach these networks unless configured
- on prem private infrastructure can be configured to connect to VPCs with VPNs or Direct Connect
- Internet Gateways can be configured to VPCs this allows for:
	- Private services (EC2 for instance) can access the internet if given a public IP address

'aws public' zone:
AWS public zone - where AWS public services operate from. Between a AWS private zone and public internet. S3 buckets.
When accessing public zone, like s3 buckets, can be accessed from home. Internet acts as transit (tunnel?).

## example:
- An internet service uses S3 (AWS public), which connects to an EC2 instance (AWS private). That internet service never directly connects with EC2. S3 acts as the staging ground and communication relay between the two. 

---
## see also:

[[Elastic Compute Cloud (EC2)]]
[[Simple Storage Service (S3)]]

