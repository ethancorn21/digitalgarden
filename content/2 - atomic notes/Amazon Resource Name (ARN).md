2026-06-20 18:23
status: #baby
tags: [[SAA-C03]]; [[technology]]

---
# Amazon Resource Name (ARN)

Amazon's unique identifier for all resources within AWS. Unique.

arn:aws:s3:::koalacampaign

all ARNs start with 'arn'. Then partition, for most AWS resources in all regions it will be 'aws'. After the partition, the service name, 's3' in this example. 

For non-globally unique resource names, the three double colons after the service will be population w/ region then account number. Since S3 bucket names are globally unique, not needed for this ARN.

---
## see also:

