[[Technology]], [[Programming]], [[INFS3400]]

```cs
using System;
using static System.Console;
using System.Globalization;

class Averages{
static void Main(){

	double[] test = {2,2,5};
	Average(test);
}

public static void Average(params double[] nums){

	double total = 0; double len = 0;
	
	foreach(double num in nums){
		total += num;
		len++;
		Write(num + " ");
	}
	
	double avg = total/len;
	Write("  -- Average is {0}", avg);
}
}
```

the parameter array is created in the arguments of the method. Its saying, "you can pass me any size array that is a double and i will accept it". The method creates the array in its header.

Then, the foreach() iterates through the array, and says "for every double in the array nums, we will add it to the total, increase the length counter, and write out what we just added".
Then we write out the average. Notice how we aren't returning anything. We are simply getting passsed an array, working with it and outputting what we worked on it with.