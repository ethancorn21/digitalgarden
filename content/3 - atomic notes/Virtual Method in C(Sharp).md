2026-03-20 17:50
status: #baby
tags: [[Technology]] ; [[Programming]]; [[INFS3400]]

---
# Virtual Method in C(Sharp)

Virtual methods can be overwritten by a method in a child class with the same signature. 

```cs
class scholarship{
	public virtual int credits{
		get {
			return credits;
		}
		set{
			credits = value;
		}
	}
}
class SpecialScholarship : scholarship{
	public override int credits{
		set{	
			credits = 0;	
		}
	}
}
```

Notice how in the child class nothing else about the credits method changes except for the set. 

---
## see also:
