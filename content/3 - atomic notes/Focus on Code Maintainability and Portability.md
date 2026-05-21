2026-05-20 08:29
status: #baby
tags: [[systems design]]; [[simplify]] ; [[analysis]]

---
# Focus on Code Maintainability and Portability

When you focus on how systems can be kept up with, improved upon, and moved to different systems. That system is now "atomic". Each system acts as its own independent function, fulfilling its job. You can change components of the system and it doesnt nuke the entire system. You can disregard or remove entire systems and there won't be a web of interconnected dependecies for each system. 

In the DOOM source code, each component of the game: UI, sound, rendering, etc. are all part of their own system. They get their inputs and do their outputs. At the end they are linked together. If one thing in one component breaks, the rest of the systems are fine. Theres a separation of function between the different components that make up the entire system. 

DOOM's organization sort of reminds me of virtualization. The system dependent code is sandboxed, while the core remains neutral and agnostic to whatever system it is running on. They had the core components like the networking, sound, video running on top of platform dependent code. That way, if they wanted to run the game on something, the core code would not need to be changed in any way, only the platform specific stuff. The stuff that interacts with the Operating System. 

---
## see also:

[[Platform Dependency Sandboxing for Cross-platform Applications]]