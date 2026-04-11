#baby 
[[Technology]], [[Programming]], [[INFS3400]]

```cs
Main(){
	testMethod(1) //This is an illegal call
	testMethod(1,B) //This is valid
	testMethod(1,B,Z) //this is valid
	testMethod(1,B,"bye") //this is invalid	
}

public static testMethod (int x, char y, double z = 0.50, string greet = "hello"){}
```

Think about why these method calls are illegal. The computer doesn't know that "bye" refers to the string variable named "greet". It only sees that you didn't include a fourth optional argument so it says, "ok we'll keep greet at its default value ("hello") and try to use this third value that was given to me for the double variable named z" . So then it says, "wait, they passed me a string for a double variable. That's obviously wrong."

The computer doesn't know that you are trying to pass the third argument as the fourth parameter. It only sees, "ok three argument, ill use the first three parameters exactly how i was passed them".

---
### see also:
[[Ambiguous Methods]]
[[Correct Ambiguous Method Calls]]