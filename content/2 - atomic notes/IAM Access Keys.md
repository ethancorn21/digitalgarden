2026-06-14 13:54
status: #baby
tags: [[SAA-C03]]; [[technology]]

---
# IAM Access Keys

Users log in use User & password for gui / web console. But in the command line, you will use AccessKeys

Both are long-term credentials. They won't change automatically or very regularly. 

Access keys vs users & passwords
	- IAM user has 1 username and 1 password. They can't have more.
	- IAM users can have 2 access keys max. They can be created, deleted, made inactive or active.

Access keys are made of 2 parts:
- access key IDs
- and Secret Access key
Save your access keys, you will never be able to see them again.
Keep your secret access key safe. Access key ID secrecy doesn't matter *as* much.

If you forget secret access key, a new one will need to be generated. 

2 access keys allows for admins to rotate access keys. Set new access key as active, delete old one.

---
## see also:

