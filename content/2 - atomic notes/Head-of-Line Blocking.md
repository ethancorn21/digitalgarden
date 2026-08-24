2026-07-26 21:57
status: #baby
tags: [[systems design]]; [[technology]]

---
# Head-of-Line Blocking

When slow requests causes subsequent requests to slow as well. Such that a bottleneck is formed where the requests are handled. The rate at which requests are served now becomes the rate at which the head of the queue is served.

How to stop this from happening?

When automated telemetry notice head-of-line blocking, reroute waiting requests to be served elsewhere. This load balances the system and allows for more through of the system as a whole.

---
## see also:

Especially dangerous in huge distributed systems. Ensure your architecture is prepared for this by [[Test Thoroughly|testing thoroughly]].