[[technology]], [[Programming]], [[INFS3400]]
#baby 

---
Fields are standard variables declared inside of objects. By standard, they should be private and only accessible to that object.
A property sort of acts like the relay between code outside of the class interacting with fields inside of the class. So instead of allowing code outside of the class to directly modify a variable inside of the class, the outside code calls the property to modify it for them. The property modifies the field by using accessors like ```get``` and ```set```. 
This allows for control and validation that the internal class fields are being set properly.

```cs
public class SoccerPlayer
{
    // 1. The private field (the actual raw data)
    private int jerseyNum;

    // 2. The public property (the gatekeeper)
    public int JerseyNum 
    { 
        get 
        { 
            return jerseyNum; // Let people read the data
        } 
        set 
        { 
            // Add a rule! Only save the number if it is greater than 0
            if (value > 0) 
            {
                jerseyNum = value; 
            }
            else
            {
		        Console.WriteLine("Jersey number must be a positive number!");
            }
        } 
    }
}
```