[[Technology]], [[Programming]], [[INFS3400]]
#baby 

---
```cs
using System;
using static System.Console;
using System.Globalization;
class SalesTaxDemo
{
	static void Main()
	{
	Sale[] arr = new Sale[10];
		for (int i = 0; i < 10; ++i)
		{
		Console.Write("Enter inventory number #{0} >> ", i+1)
		string inventoryNum = ReadLine();
		Console.Write("Enter amount of sale >> ");
		double saleAmount = Double.Parse(ReadLine());
		arr[i] = new Sale
		{
			InventoryNumber = inventoryNum,
			Amount = saleAmount,
		};
	}
		for(int i = 0; i < 10; ++i)
		{
	Console.WriteLine("Sale # {0} Amount: {1} Sale {2}",+1,arr[i].InventoryNumber,
	 arr[i].Amount.ToString("C", CultureInfo.GetCultureInfo("en-US")));
	 
	Console.WriteLine(" Tax is {0}",
	 arr[i].Tax.ToString("C", CultureInfo.GetCultureInfo("en-US")));
		}
	}
}
public class Sale
{
	public string InventoryNumber{get;set;}
	public double Amount{get;set;}
	public double Tax{
		get{
		if(Amount>100){return ((Amount-100)*.06) + 8.00;}
		else{return Amount*.08;}
		}
	}
}
```