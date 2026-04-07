[[INFS3400]] , [[Programming]]
#baby

```cs  
 private static double FindMedian(int[] array)

   {
      double median;
      int middle = array.Length/2;
      Array.Sort(array);
      if(array.Length % 2 == 0){ 
      //if array = even, find the middle point between 2 central values
          median = (array[middle - 1] + array[middle]) / 2;
      }
      else{
          median = array[middle];
      }
      return median;
   }
```



i was struggling to get the media value to cast the division of the 2 array values to a double.  Its because of the / 2. Because the arrays are both int arrayys, the division is assumed to go to an int. So, when it is divided by an int (the int 2), its cast to an int instead of a double.

the fix was just to declar the /2 as / 2.00 so that way its saying, you are diving these int values by a double, cast the ints to double. 