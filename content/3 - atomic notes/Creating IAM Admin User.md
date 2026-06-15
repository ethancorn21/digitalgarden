2026-06-14 13:10
status: #baby
tags: [[technology]]; [[SAA-C03]]

---
# Creating IAM Admin User

You should pretty much never log in as root, always create a admin with succinct privileges.

Search for IAM service.

Go to AWS account box on the right hand side. The sign-in URL for IAM users will be a long URL. In order to shorten it, we will create an account alias.

I will name mine `ethan-saa-2026`
create a bookmark for the URL.

On the left hand side under IAM > Users > create user
- `iamadmin` - only needs to be unique among your AWS account
- provide access to AWS management console
- set password

If you are creating an account on *behalf* of a user, *ALWAYS* require that the user must create a new password at next sign-in. But if you are creating an account for yourself, you can just leave it unchecked and use the password you set in the above step.

## assign perms

for our purposes: 
- attach permissions directly
- use default "administrator access" policy
- scroll to bottom > next > create user > return to users list

## Assigning MFA

IAM > Users > iamadmin > security credentials > assign MFA device

give it a name, qr code, go through adding process

## test

sign out > sign in iamadmin account.

ensure you are in the general admin account *NOT* root user.

---
## see also:

