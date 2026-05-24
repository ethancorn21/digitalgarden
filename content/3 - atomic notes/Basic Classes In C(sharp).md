[[technology]], [[Programming]], [[INFS3400]]
```cs
using System;
using static System.Console;
using System.Globalization;
class TestSoccerPlayer
{
	static void Main()
	{
		SoccerPlayer me = new SoccerPlayer();
		me.Name = "Ronaldo";
		Console.Write(me.Name)
	}
} 

public class SoccerPlayer
{
	public string Name = "";
	public int JerseyNum;
	public int Goals;
	public int Assists;
}
```

c# (for search purposes)