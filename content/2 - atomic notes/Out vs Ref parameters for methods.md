[[technology]] , [[Programming]], [[INFS3400]]

Ref parameters refer to the actual location in memory of the variable. They ensure that the actual variables is being altered by the method, not a copy of the value of the variable. When you need a method to actually alter the value of the memory location, use a ref parameter. If you ref values a and b, the method would modify what a and b are. The methods changes and works *on* the value.

Out parameters are used when the method itself is creating the value, not modifying it. So an out parameters will be passed values a and b, and return c. The method will use a and b to calculate c. It will work with the values not *on* them.

