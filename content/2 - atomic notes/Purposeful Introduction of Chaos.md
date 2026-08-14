2026-07-26 21:40
status: #baby
tags: [[systems design]]; [[analysis]]

---
# Purposeful Introduction of Chaos

A system needs to be tested and strained in order to see it's flaws. You can purposefully introduce chaos into your systems that you can understand how the system reacts and what steps are needed to regain function of the system. Take out and shut off a piece of the system and what happens?

Netflix created Chaos Monkey, an application that would randomly shut off processes inside their own servers to see what would happen. The goal was for process to instantly start back up if Chaos Monkey shut them off, such that their systems were now fault tolerant and more resilient because of the introduced Chaos.

By introducing faults and causing a system to deviate from it's spec and creating automatic process that fix those faults. You can better ensure that future faults will not cause failure in the system, or the complete shutdown of the system as a whole.

---
## see also:
From: [[Designing Data Intensive Applications (DDIA)]]

[[Fault Tolerance]], [[High-Availability]]