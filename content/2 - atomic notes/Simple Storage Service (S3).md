2026-06-15 17:54
status: #baby
tags: [[SAA-C03]]; [[technology]]

---
# Simple Storage Service (S3)

Think of this as your hard drive in the cloud. 

But instead of files, its objects. Unlike a server or EC2 instance, you don't install an OS. You simply store and retrieve storage objects.

S3 is a public AWS service. It's only public because it is stored on the AWS edge. *NOT* because it is publicly accessible. It can be publicly accessible but by default it is configured to only be accessible to the AWS account.

Regionally resilient. Tolerates failure of an AZ.

Should be your default storage.

Two types of storage:
- objects - datasets, photos, vides, etc.
- buckets - containers for objects. Should be default for configuration for how S3 works.

## Objects

Objects are made of 2 different components:
- Object key - like a file name. Identifies an object inside a bucket. If you know the key and bucket, than you can uniquely access the specified object.
- Object value - The data and how big the content being stored is. Can range from zero bytes to 5 TB.

Objects also contain:
- version ID
- metadata
- access control

## S3 Buckets

data inside a bucket has a primary home region. It won't leave that region unless configured. Data never leaving specified region has benefit of data compliance in home region.

*Bucket names are globally unique*. They must be unique across all regions and all AWS accounts. Names must be between 3 - 63 character, all lowercase no underscores. Can't be formatted like IP. 

Soft limit of 100 per AWS account. 1000 hard limit. Meaning there can't be a single bucket per user if you have 101 users. You can however use S3 prefixes to create pseudo buckets inside 1 singular bucket. Allowing an unlimited number of users to use one partitioned bucket.

Buckets can hold unlimited objects. 

No complex structure, meaning all objects are stored in the same level. There is no folders within folders.

### *but*

You can create folder in the UI, by naming the objects as /foldername/object.txt

this will place the object txt file into a folder called foldername

Folders are called prefixes in S3. They prefix the object name.

object store vs file store vs block store.
- block store = virtual hard disk, limited to one access at a time. So one EC2 instance for example accessing the disk. Block stores are mounted as drives, think (E:\) files.

good for offloading data to. Can shrink instance usage so its cheaper.

Should be the default go to for input/output to many AWS services.

---
## see also:

