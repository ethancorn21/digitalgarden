[[INFS3400]], [[Programming]]

multifile assembly - storing methods in classes and files. These can be deployed to whatever project you are working on so that when you create a new project, you can just reuse the methods in that new project. Very modular.

anatomy of methods: 

```cs
private static void ThisIsAMethod()
{
	WriteLine("this is the body");
}
```

- A method must include a declaration (aka header or definition), an opening curly brace, a body, closing curly brace,
- in the method above, "private" is an access modifier. Whether it can be accessed outside of its class. If none declared = private by default
- static modifier is optional
- Methods must have a return type (int, double, string, void, etc).
- method parameters are the 2 parenthesis (), where you usually put input parameters. These are optional


Types of method accessibility:
- public
- private
- protected internal
- protected
- internal

Types of parameter:
- formal
	- this is the parameter declared in the header of the method, ie (double price) or (int num).
- actual
	- this is the parameter when the method is invoked.
		- callTheMethod(X) : X is the actual parameter that is passed to the method.


argument types = data types