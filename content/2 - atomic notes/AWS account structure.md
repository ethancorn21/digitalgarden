2026-06-14 14:22
status: #baby
tags: [[SAA-C03]]; [[technology]]

---
# AWS account structure

root user - never log into

iamadmin - handles the account stuff. Purely for corporate stuff, never any actual deployments. So this is used for creating new iam accounts, billing alerts, deleting users, assigning perms, etc. Give full admin access.

production - this will be a full admin access account as well, only the scope of responsibilites would change. This would be the Cloud Architects account with full admin access as well, but it can tear down and build whatever infrastructure it wants.

general - this is just your cloud engineer account with poweruser access. If it needs something more substantial, it should escalate it to the cloud architect. This will be the account you use most. T

---
## see also:

