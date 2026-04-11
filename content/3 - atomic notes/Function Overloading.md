
[[Technology]], [[Programming]], [[INFS3400]]

Overloading a function is creating two functions with the same names. The functions can then take different parameters but be called by the same name. It ensures that theres extra redundancy and availability of the function.

```cs
class DebugEight2{
	static void Main(){
	int numericScore = 82;
	string letterScore = "B";
	
	Write("Score was {0}. ", numericScore);
	GiveBonus(ref numericScore);
	WriteLine("Now it is {0}.", numericScore);
	Write("Grade was {0}. ", letterScore);
	GiveBonus(ref letterScore);
	WriteLine("Now it is {0} .", letterScore);
	}

	public static void GiveBonus(ref int testScore){
	const int BONUS =+ 5;
	testScore = BONUS;
	}

	public static void GiveBonus(ref string letterScore){
	const string BONUS = "+";
	letterScore = letterScore+BONUS;
	}
}
```