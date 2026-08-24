2026-07-26 21:54
status: #baby
tags: [[systems design]]; [[analysis]]

---
# Set Up Telemetry

A rocket that leaves the ground always stream valuable data of what is happening inside the rocket back to HQ. Why are the systems, projects, organizations that you are apart of not the same way? 

Create telemetry by making visible metrics. Measure performance, error rates, satisfaction, etc. Anything you can do to create monitoring, especially automated monitoring. This allows you to get the pulse of what is happening inside the system at a glance.

Settle on what the KPI's of the system are. Then go from there. This will tell you what is important to monitor. Be careful though as metrics have a way of becoming the goal. As such be careful that you are not optimizing to fulfill metrics, but instead to maximize the intended value add of the system.

---
## see also:

[[Proxy Metrics Are Bad Measurements]] - ensure that the KPI's and metrics you land on are actually relevant to the work that is being measured. For example, you wouldn't measure availability of a server by how often it is powered on, but instead how consistently it is serving info versus how often it drops off.