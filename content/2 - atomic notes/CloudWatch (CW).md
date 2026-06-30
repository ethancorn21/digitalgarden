2026-06-20 19:15
status: #baby
tags: [[SAA-C03]]; [[technology]]

---
# CloudWatch (CW)

Collects and manages operational data for you

Performs 3 main jobs:
- Metrics - ex: EC2 instance cpu usage, resource utilization
	- CloudWatch Agent  can monitor things outside of AWS.
- CloudWatch logs
- CloudWatch Events - generates events in response to other events. Can also schedule events (like cron jobs)


Data feeds into CloudWatch through metrics. CloudWatch can then use this data for alarms to trigger auto scaling, or for statistics to be scraped through the console or APIs.

Namespace - containers for monitoring data
- contain related metrics

metrics is a collection of related data points in a time ordered structure.
- starts when monitoring is enabled, stops when disabled.
- CPU utilization, network utilization, etc.
- each reported utilization = a datapoint
	- made up of 
		- timestamp when measurement was conducted
		- value

Alarms - ok, alarm, insufficient data states



---
## see also:

