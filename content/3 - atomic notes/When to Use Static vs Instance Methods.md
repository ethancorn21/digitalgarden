[[INFS3400]], [[Programming]]
#baby

use static methods when you only need to pass inputs to a method. The internal state of the method does not change.
	- For example if you created a method that adds 2 numbers together, you would only need to pass the 2 numbers, no need to change anything about the internal state of the method

Use instance methods when the internal state of the method does change. 
	-  For example, if you created a method that tracks or uses live data to constantly change you would want an instantiated method. Common example is a method that shows bank balance, transfers, and deposits. After creating the class and getting the values, the three values inside the method would constantly be updating with every spent or deposited penny.

