2026-07-08 17:20
status: #baby
tags: [[technology]]; [[SAA-C03]]

---
# IAM Roles

An IAM user is an individual. A role is an identity. It specifies the level of access. It is a temporary permission you assume for a short period of time.

IAM roles can have two types of policies attached, trust and permissions policies. 

Trust policies specify who is able to assume the role, whether that be users, apps, or even anonymous usage. 

Temporary Security Credentials are generated and every time the IAM role goes to access something, the credentials are checked against the permissions policy. If the permissions policy allows it, any identity that assumes a role, can use the resource. 

## Examples of where to use IAM roles

- Use IAM roles where possible instead of access tokens, because roles are only assumed for the amount of time it takes to complete a task, then the credentials are revoked (seconds - minutes). So if a piece of code needs to run in AWS Lambda and access an S3 bucket and something in CloudWatch. Lambda would assume the role, Secure Token Service (STS) would create a temporary credential and compare it against the permissions policy, then access S3 and CloudWatch.

- In break-glass in case of emergency situations, users in a certain group can elevate their own privileges. Users can assume an emergency role if absolutely required. Everything will be logged and reported.

- External identities can't access anything in AWS directly. But there can be an IAM role that can be assumed by an external identity (like someone in AD) and then that person can interact with AWS directly. 

- Since there is a 5000 user limit to accounts, large applications with millions of users are limited. But roles can be used in a process call Web Identity Federation. For example, using Google, X, Facebook, GitHub to sign into an app instead of a login, which you can say, "these people will use this role". So makes use of an existing account and applies a role to that. NO AWS CREDENTIALS so you are not hitting the hard cap of 5000 users ever.

- Your orgs AWS account needs to use resources in a partners AWS account. There are 1000's of identities in your AWS account so your partner does not want to recreate those 1000's of identities. Well, the partner can just create a single role that allows access to that resource, your identities will just assume that role to get temp security credentials to gain authorization to those resources.



---
## see also:

[[IAM users]]
