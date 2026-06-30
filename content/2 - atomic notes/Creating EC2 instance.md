2026-06-18 17:44
status: #baby 
tags: [[SAA-C03]]; [[technology]]

---
# Creating EC2 instance

Ensure you are logged into general iamadmin account with us-east-1 (N. Virginia) is selected.

Search for EC2

Time to set up SSH key pair.

On the left menu:
Network & Security > Key Pairs > Create key pair > name it A4L (course recommended) > key pair type = RSA > private key file format: Windows = .ppk , Mac/Linux = .pem

Browser will want to save, SAVE IT.

Now on the left menu:
instances > launch instances > name instance > use Amazon Linux for AMI, use default option > instance type = t3.micro (or default) > select A4L keypair > use default VPC settings > enable auto-assign public IP > create security group > name it MyFirstInstanceSG (copy to description) > inbound security group rules > type = ssh, source type = anywhere > configure storage = default from AMI > launch instance

View all instances > will start in pending. Will change to running instance state. Status check will go from Initializing > x/x checks passed

right click the instance > connect > connect (opens EC2 web console which is useful for quick stuff). 

# *IMPORTANT* 
Right click and terminate the EC2 instance.
Then in the left hand menu > Network & security group > terminate security group. *if it doesn't let you, wait for instance to spin down*. Afterwards, only default security group is left for the default VPC.

---
## see also:

