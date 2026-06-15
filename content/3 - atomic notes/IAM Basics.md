2026-06-14 12:51
status: #baby
tags: [[technology]]; [[SAA-C03]]

---
# IAM Basics

Root user has full unrestricted access to account. It can't be restricted access in anyway.

Users will need access to AWS accounts. They will need to do their tasks and responsibilities, but they should haven't access outside of that scope (principle of least privilege).

Very few people should have access or even know the password for root user. Limiting exposure. 

IAM gives more control over what permissions are given to users. Every AWS account has it's own instance of IAM, it's own database. IAM is globally resilient, all data is secure across all AWS regions. IAM can do anything in the account, like a root user. 

Inside IAM you can create different identities. Allows identities to do certain things, when IAM tells a service that an identity is allowed to do something, the service trusts that account like it trusts IAM.

IAM allows you to create three separate identity objects:
- users
- groups
- roles

Users represent humans or applications that need access to AWS account. 

Groups are collections of related users. So infrastructure, HR, finance users are grouped together.

Roles are used to AWS service for granting external access to your account.

Use users when you know who/what is going to use it. Use roles, when you don't know the exact number of users.

IAM policies
- can be used to allow or deny access to AWS services *only* when they are attached to an identity objects


IAM has 3 jobs:
- manage identities - create an manage IDs
- authenticate - prove who you claim you are
- authorize - allow or deny access to resources after authentication

IAM = free. Global service, one global database. IAM only controls what its identities can do to your AWS accounts, not external users in external accounts. Allows for MFA and ID federation.

Identity federation - can take an existing account and use it to access AWS resources. For example, using your Active Directory account to authorize you to access Finance's AWS resources.

---
## see also:

