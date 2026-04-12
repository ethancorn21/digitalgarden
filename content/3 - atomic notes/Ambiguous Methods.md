[[technology]], [[Programming]], [[INFS3400]]

---

Ambiguous methods are method that can be passed with more or less information.
For example if you were given two measurements length and width you would be able to calculate square foot, but if you were given a third measurement, you would be able to calculate volume. So, the first two measurements are vital , but the third can be left out depending on what the user needs done.

```cs
using System;
using static System.Console;
using System.Globalization;
class Movie{
static void Main()
{
	DisplayMovie("Titanic", 128);
	DisplayMovie("Titanic");
}

public static void DisplayMovie(string movie, int runtime = 90){
	WriteLine("The movie {0} has a running time of {1} minutes.",movie,runtime);
}
}
```

notice how the DisplayMovie method has the argument "runtime" set at 90. That means its a default value. So if an int isn't passed to the DisplayMovie method, then it will default that int value to 90. For example, if i passed DisplayMovie("Titanic", 128), the output would show the run time as 128 minutes, versus if i called DisplayMovie("Titanic"), the runtime would display as 90 minutes. This is because its an optional parameter.

*but* the optional parameters must come at the end of the arguments list. For example, in the method above, runtime can't come before movie. If it did, we would have to make movie also an optional parameters.

---
### see also:
[[Illegal Ambiguous Method Calls]]
[[Correct Ambiguous Method Calls]]