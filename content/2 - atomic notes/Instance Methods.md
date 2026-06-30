[[technology]], [[Programming]]
#baby

Instance methods are methods that are specific to a class. You must instantiate a version of that class into your current class to call the method.

```java
import java.io.*;

class Test {
    String n = "";

    // Instance method 
    public void test(String n) { 
      this.n = n; 
    }
}
class Geeks {
    public static void main(String[] args) {

        // create an instance of the class
        Test t = new Test();

        // calling an instance method in the class 'Geeks'
        t.test("GeeksforGeeks");
        System.out.println(t.n);
    }
}
```
Source: [GeeksForGeeks.org](https://www.geeksforgeeks.org/java/static-methods-vs-instance-methods-in-java/ )

