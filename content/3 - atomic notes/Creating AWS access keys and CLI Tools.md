2026-06-14 14:01
status:
tags: [[SAA-C03]]

---
# Creating AWS access keys and CLI Tools

log into iamadmin account. 
- IAM > security credentials > create access keys > CLI > confirm > next > description (`local CLI iamadmin-general`) > create access key
- you will be shown your access and secret access key.
- copy them down and safely store them.
- done
- can activate and deactivate inside "actions" drop down.
- max 2 access keys per identity
- create another access key
- go into the "actions" drop down and delete it
	- you will need to deactivate it first

install v2 of the AWS CLI

```
aws configure --profile iamadmin
*enter id then secret key

*test to see if it works - should return empty string if new account (no errors)
aws s3 ls --profile iamadmin
```

---
## see also:

