2026-06-14 12:11
status: #baby
tags: [[SAA-C03]]; [[technology]]

---
# AWS Accounts

AWS accounts can be seen as containers for identities and resources. AWS accounts container users which you log in with. And resources which you provision to that account. 

AWS account needs name, unique email address, payment method.
- email must be unique for each AWS account
- email is used to create root user
	- so email can only ever be used to log into one root user ever
	- like any root user it has access to everything, including all users and resources inside the account
Pay as you go, but theres a free tier of usage.

IAM - Identity and Access Management
- users, groups, roles
- can be configured for whatever account / resources needed.
- all users start with no perms

AWS accounts are good at containing actions to one account
- blowing stuff up is usually isolation to one account, whether compromised or misconfigured
- think about compromised accounts, that one account will be compromised but not other ones, meaning hackers can delete one account and your other will be fine.
- So if there is a production, dev, and testing account. If the dev account is compromised, not all is lost because the production and testing accounts are likely still fine.

---
## see also:

