2026-06-20 18:35
status: #baby
tags: [[SAA-C03]]; [[technology]]

---
# CloudFormation (CFN)

## templates

Templates for creating and updating AWS infrastructure/resources.

uses YAML or JSON. Preference for which you want to use.

resources section:
- must be there, if no resource how AWS use?

Version section:
- used for organization, if not filled, will be assumed by AWS

Metadata:
- can control how different part of template's UI appear in CFN

Parameter section:
- allows prompts from users

Resources inside a CFN template are called 'logical resources'. Logical resources has:
- resources has types. CFN uses it to use what to create
- properties - CFN uses to configure resources in specified way

When template is first given to CFN, it creates a stack. A stack contains all the logical resources that a template tells it to contain. A stack is created when you give CFN a template and tell it to do something with it.

The stack is then used to create a physical resource inside your AWS account. When you create a template and send it to CFN. CFN creates a stack with logical resources inside that match the specified logical resources of the template. Then CFN spins up physical resources (EC2, S3, etc.) that match and sync with the stack's logical resources.

A new template can be uploaded, and CFN will update the stack, syncing updates to already existing logical and physical resources.

*IF YOU DELETE A STACK, THE PHYSICAL RESOURCES IT CREATES WILL ALSO BE DELETED*

CFN allows you to automate infrastructure. CFN helps with change management as well. It's IaC. Dope.

---
## see also:

allows automation of infrastructure tasks such a deploying a new [[Elastic Compute Cloud (EC2)]] instance. By creating new resources from a template you are keeping configuration run away to a minimum. DevOps and IaC principles.