2026-07-02 15:03
status: #baby
tags: [[technology]]; [[SAA-C03]]

---
# IAM users

IAM users are identities create for long-term AWS access, whether it be access for humans, applications, or services that need to access AWS. 

99% of the identities you create will be IAM users. 

Principle (person) sends request to IAM to gain access to AWS. The Principle must authenticate to IAM with username & password / Access keys. So, the principle must authenticate and prove that it is who they claim to be. Principle becomes authenticated identity. AWS now applies policies to that principle through the identity.

- only 5000 IAM users per AWS account
- an IAM user can only be in 10 groups
- issue for internet-wide applications

This limit can be architected out with IAM roles and federating identities



## Amazon Resource Names (ARN)

Unique identifier for any resource within any AWS account


arn:awss:s3:::catgifs --- references only the bucket not the objects inside
arn:awss:s3:::catgifs/* --- references objects inside bucket



---
## see also:

[[IAM Basics]]

[[IAM Identity Policies]]