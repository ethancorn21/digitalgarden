2026-06-15 18:17
status: #baby
tags: [[SAA-C03]]; [[technology]]

---
# Virtual Private Cloud (VPC)

Virtual network inside AWS. Within an AWS account, within a region of that AWS account. Regional service, so regionally resilient. They operate from multiple AZs inside a region.

VPCs are default private and isolated. Isolated from other VPCs as well. Unless configured otherwise.

Two types of VPCs available inside a region:
- default VPC
- custom VPC

default VPCs have a max of one per region. ONE DEFAULT PER REGION. AWS auto configures these. 

custom VPCs can have many. Customized to fit your needs. You must configure everything end to end. All serious AWS deployments will need custom VPCs. Can be linked to other VPCs, on prem networks, even other cloud provider networks.

## Default VPC ARCHITECTURE

AWS account
- us-east-1(region)
	- VPC-1
	- VPC-2 (can't communicate with VPC-1 unless configured)
- us-east-2(region)

Each VPC will have a VPC CIDR which = the IP address range (or block) or the VPC. Default VPC will always have the same CIDR: 172.31.0.0/16

The VPC CIDR can be split into subnets. Each subnet is split into a separate AZ.
- default will always be 172.31.0.0/16
- will be split into subnet A,B,C
- subnet will be assigned to each AZs (if we were used us-east-2 as a region): us-east-2a, us-east-2b, us-east-2c
- us-east-2a - 172.31.0.0/20
	- 172.31.0.0 - 172.31.15.255
- us-east-2b - 172.31.16.0/20
	- 172.31.16.0 - 172.31.31.255
- us-east-2c - 172.31.32.0/20
	- 172.31.32.0 - 172.31.47.255

Automatically provided with Internet Gateway, Security Group, Network ACLs (access control lists)
Services in the default VPC will automatically be assigned public IPv4 addresses



---
## see also:

