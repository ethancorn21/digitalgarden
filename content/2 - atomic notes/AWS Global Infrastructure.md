2026-06-15 17:58
status: #baby
tags: [[SAA-C03]]; [[technology]]

---
# AWS Global Infrastructure

## AWS Regions
- not geographic regions, just where full AWS infrastructure is. Think big ass data center complexes.
- can use regions to design solutions built to withstand global disasters
	- a problem in one region doesn't affect another region
	- geographic, geopolitical separation
		- data will not automatically move between regions (goverance)
- when you interact with AWS you are most likely interacting with AWS in a specific region

Region code - ap-southeast-2
Region name - Asian Pacific (Sydney)

Availability Zone (AZ):
- isolated compute / infrastructure inside a region 
- if something happens inside one AZ, the other ones will likely be fine
- multiple AZs inside a region = resilience
- AZ with region code - ap-southeast-2a, ap-southeast-2b

Service resilience:
- globally resilient - data is replicated across multiple regions (world catastrophe to experience outage). IAM = globally resilient (even if multiple regions fail, IAM will not fail)
- Region resilient - data is replicated to multiple AZs to inside one region. If one AZ fails, service will not fail. Will only fail if entire region fails.
- AZ resilient - run from single AZ. If AZ fails, service fails. Very prone to failure with AZ failure.

## AWS Edge Locations
- much smaller than region data centers
- more locations than regions
- usually only host content delivery
- think "putting data close to customers for fast data transfers"

## Example:
PetCo would have its infrastructure in a few regions of the world, but the content of it's website would be in many edge locations worldwide.

check out infrastructure.aws for globe view of AWS regions and Edge locations



---
## see also:

