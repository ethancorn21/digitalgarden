2026-06-15 17:41
status: #baby
tags: [[technology]]; [[SAA-C03]]

---
# Elastic Compute Cloud (EC2)

EC2 is the virtual compute of the cloud in AWS. CPU / Memory (RAM), is scalable to whatever you need. Virtual capacity is rented instead of full servers.

EC2 is IaaS. EC2 instance = VM. 

AZ resilient, if AZ fails then instance fails. 

Runs operating systems (Windows or Linux), applications, databases, data processing. It is your compute. Pretty much anything you would need a server for.

EC2 instances are highly elastic. They can be destroyed instantly or scaled up 100x just as fast.

EC2 lives inside of VPCs (Virtual Private Cloud). They can be public if given a public IP in a public subnet. But usually they are kept private behind a firewall

Pay for what you consume. Charged for every second or hour that the instance is running (on-demand billing). 

EC2 has local storage or network storage called Elastic Block Store (EBS).

EC2 states:
- running
- stopped
- terminated - non reversible action. Instance will be fully deleted.
When instance is running, charged by CPU, Memory, EBS, and Networking activity. 

When instance is stopped, not charged for consumption of resources, but charged because storage is still allocated to the instance. Sure the instance stops, but the storage is still in use holding the OS, etc.

Amazon Machine Image (AMI) - similar to an OS image. 
- contain attached permissions
	- public - everyone is allowed
	- owner - implicitly allowed
	- explicit - only specific AWS accounts allowed (configured)
- Contains root volume - The drive that boots the OS. Can contain extra drives, but will always have the boot volume. 
- Block device mapping - contains all disk volumes and specifies whether they are a boot volume or a data volume.

Depending on the AMI, connecting to EC2 instance requires different port #'s
- Windows - Remote Desktop Protocol - port 3389
- Linux - SSH - port 22
	- use SSH key pair to authenticate
		- public & private key
	- use command prompt or putty to remote in


---
## see also:

[[Public vs Private AWS Services]]
