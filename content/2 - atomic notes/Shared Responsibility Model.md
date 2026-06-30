2026-06-22 18:22
status: #baby
tags: [[technology]]; [[SAA-C03]]

---
# AWS Shared Responsibility Model

AWS is responsible for the security of the cloud. You are responsible for the security IN the cloud. 

So AWS looks after:
- AZs, edge locations, regions. 
- Hardware/AWS global infrastructure
	- compute storage
	- database
	- networking
- software
	- EC2
	- S3
	- any service that AWS provides

You take responsibility for the OS upwards:
- OS,NETWORK,FIREWALL CONFIGS
	- client-side data - integrity, authenticity, encryption
	- server-side encryption - file systems & data
	- networking traffic - traffic protection, integrity, identity
- Platforms, apps, IAM
- customer data

Helps you understand where AWS's job ends and yours starts. 

---
## see also:

