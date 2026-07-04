2026-07-01 17:46
status: #baby
tags: [[SAA-C03]]; [[technology]]

---
# IAM Identity Policies

## IAM Policy document
- made up of statements
	- SID - statement ID (what it actually does)
	- effect - allow or deny if the action and resource part match your attempt
	- action - what action you are performing on a resource
	- resource - the specified thing you are trying to act on (uses ARN)
- can use wildcards *
- action s3:* , resource *
	- allows for all actions inside of s3
	- s3 admin
- If there are multiple statements that apply to an operation, both will process. You can have access to all of S3 but be denied from a certain bucket.

- explicit denies overrule everything else.
- explicit allows take affect unless explicit deny.
- default deny acts as a catch all (think firewalls)
	- DENY, ALLOW, DENY

policies are collected from users, groups, and resources but they are all evaluated at the same time. It follows DENY, ALLOW, DENY

## Two main types of policies:
inline policies: 
- applying JSON policies individually to each user
- unique to each individual
- for exception/special circumstances to individuals
managed policy:
- attach JSON policies to identities
- reusable
- for use in giving access to lots of people
- low mgmt overhead


---
## see also:

[[IAM Basics]]