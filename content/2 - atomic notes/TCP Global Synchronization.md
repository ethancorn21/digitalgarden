2026-08-23 18:02
status: #baby
tags: [[networking]]; [[technology]];

---
# TCP Global Synchronization

TCP sliding pane's adjust to network traffic to allow more packets to flow. This increases the allowed TCP packets to a point where they clog the network. As such the slide pane adjusts again and limits the amount of TCP packets flowing. But, because the congestion is now limited, the slide pane adjusts once more to increases the amount of TCP packets that are allowed, one more congesting the network and keeping the cycle going.

Fixed with RED/WRED (weight random early detection). Routers will drop packets when they sense queues are getting full. Not a problem as TCP packets when not acknowledges just send a duplicate packet and try again.

---
## see also:

Stems from First In First Out (FIFO) queuing method. Same with [[Head-of-Line Blocking]]