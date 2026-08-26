2026-08-25 11:54
status: #baby
tags: [[systems design]]; [[technology]]

---
# Canary Release Testing

The process of releasing software to a select group of people rather than pushing new software to the entire cohort.

Usually accomplished by changing the load-balancing settings on the load-balancer by routing a select fixed percentage of requests/users to a new version of the software.

Especially useful for user led testing. Ensure quick roll backs if necessary for user with particularly broken builds.

Metrics to monitor for with canary users:
- error rates - what is the % of requests that are dropping off?
- performance - how is the new version in terms of performance vs previous release?
- availability - how is the availability?

---
## see also:

apart of [[Test Thoroughly|testing thoroughly]]. 

Figure out the mental framework for using in conjunction with agile methodology/DevOps environments.