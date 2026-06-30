[[technology]], [[Programming]] , [[INFS3400]]


A memory address is a reference to a location in memory. Passing data types by reference means that whatever they are passed to can access and change/edit whatever is at that location. This is opposite data values passed by value. When a data type is passed as a value, the method can see that data type, not its location in memory. Essentially it becomes "read only".

2 types of method parameter classifications:
- mandatory parameters - must be specified in every method call
- optional parameter - the method will provide a default value if one is not specified.

Types of parameters:
- value parameters - parameter is passed to a method and method receives copy of that value. Changes to value inside the method don't change whats passed to it.
- reference parameters pass a reference in memory to the original variable, method values can change these parameters
- output parameters - specify what will be returned from a method, must be initialized when method is initialized. 