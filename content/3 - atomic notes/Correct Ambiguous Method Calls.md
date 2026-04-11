[[Technology]], [[Programming]], [[INFS3400]]

---
``` cs
// Program demonstrates method that can be called
// with one, two, or three arguments
// Tuition is $80 per credit
// Default district code is I.
// If student is in-district (code I), then there is no
// out-of-district fee, which is $300
// Default scholarship status is false.
// If student is on scholarship, tuition is free
using static System.Console;
class DebugEight3{
static void Main(){z
	WriteLine("Tuition is {0}",CalculateTuition(15));
	WriteLine("Tuition is {0}",CalculateTuition(15,'O'));
	WriteLine("Tuition is {0}",CalculateTuition(15,'O', true));
}

public static double CalculateTuition(double credits, char code = 'I', bool scholarship = false){
	double tuition;
	const double RATE = 80.00;
	const double OUT_DISTRICT_FEE = 300.00;
	tuition = credits * RATE;
	if(code != 'I')tuition += OUT_DISTRICT_FEE;
	if(scholarship)tuition = 0;
	
	return tuition;
}
}
```

This is the correct way to call an ambiguous method. Notice how the default values are at the end, with the required parameters at the beginning. 
If the CalculateTuition method isn't give a char or bool value, it will default to it's own.

---
### see also:
[[Ambiguous Methods]]
[[Illegal Ambiguous Method Calls]]