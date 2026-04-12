2026-03-27 10:06
status: #baby 
tags:[[technology]] ; [[Programming]]; [[INFS3400]];

---
# Interfaces in C(sharp)

Interfaces in C# are like a contract. Any class that implements an interface must implement the methods outlined in that interface. 

Interfaces are powerful because they allow for consistent interactions with different types.

```cs
public interface IReversable
{
	void Reversable();
}

class Soldier : IReversable
{
```

So the Soldier class must have a Reversable() method declared in its body or else it wont compile. But, the IReversable interface does not specify what the method does, only that it must be implemented.

In the future if we needed a tank, plane, and car class. Their reverse method would be slightly different, but it would allow us to standardize that it needs to be there. Again, consistent interactions with different types.

---
## see also:

