2026-07-07 17:16
status: #baby
tags: [[technology]]; [[SAA-C03]]

---
# IAM Groups

Containers for IAM users. No credentials, not able to be logged into. They are only used for organizing groups.

One user can be in multiple groups. 

Can have inline and managed policies attached to them.

Groups can have policies, the users in that group can have separate attached policies. Policies are merged from all group and user policies. Deny, allow, implicit deny.

There is no default all users in an account group. It does not exist natively.

Groups only contain user, not other groups.

300 groups per account soft limit.

Policies can't grant access to groups. So you can't have resources giving permissions to users, only users getting permissions to access resources.

---
## see also:

