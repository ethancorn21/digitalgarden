2026-05-20 08:31
status: #baby 
tags:[[technology]], [[Programming]], [[systems design]]

---
# Platform Dependency Sandboxing for Cross-platform Applications

For programs to run on different operating systems in different environments. The code must be split into platform dependent and platform agnostic code. This ensures that any code that relies on a windows or linux process is solely only ever run on the respective platform. 

Super hard to implement because you have to keep track of what systems are platform dependent, then create a viable workout for the rest of the code to function in said instance.

---
## See also:

The architecture of DOOM source code which allows it to run on anything.
[[Focus on Code Maintainability and Portability]]
