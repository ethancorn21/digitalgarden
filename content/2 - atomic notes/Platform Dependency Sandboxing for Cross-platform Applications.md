2026-05-20 08:31
status: #adult
tags:[[technology]], [[Programming]], [[systems design]]

---
# Platform Dependency Sandboxing for Cross-platform Applications

For programs to run on different operating systems in different environments. The code must be split into platform dependent and platform agnostic code. This ensures that any code that relies on a windows or linux process is solely only ever run on the respective platform. 

Super hard to implement because you have to keep track of what systems are platform dependent, then create a viable workout for the rest of the code to function in said instance.

Great architecting requires you to think in the way. The ability for an architected system to be adaptable and portable to the current needs, but also the foreseen and unforeseen future needs.

Even your Obsidian notes follow this principle. Atomic notes that can be reorganized in thousands of different ways, creating new utility and meaning with each new reorganization.

---
## See also:

The architecture of DOOM source code which allows it to run on anything.
[[Focus on Code Maintainability and Portability]]
