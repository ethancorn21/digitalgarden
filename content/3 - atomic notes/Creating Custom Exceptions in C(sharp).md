2026-04-09 14:04
status:
tags: [[Technology]]; [[Programming]]; [[INFS3400]]

---
# Creating Custom Exceptions in C(sharp)

Creating custom Exceptions in C# is about extending the extension class. 

Here is an example from a banking application:
```
Class NegativeBalanceException : Exception{
	Private static string msg = "Bank balance is negative.";
	Public NegativeBalanceException() : base(msg)
	{
	}
}

Class BankAccount{
	Private double balance;
	public int AccountNum{get; set;}
	public double Balance{
		get{
			return balance;
		}
		set{
			if(value < 0){
				NegativeBalanceException nbe =
				 new NegativeBalanceException();
				throw(nbe);
				
				//instead of creating a new nbe object, you can do:
				// throw(new NegativeBalanceExpetion());
			}
			balance = value;
		}
	}
}

class TryBankAccount{
	static void Main();{
	BankAccount acct = new BankAccount();
	try{
		acct.AccountNum = 1235;
		acct.Balance = -1000;
		}
		catch(NegativeBalanceException e){
			WriteLine(e.Message);
			WriteLine(e.StacKTrace);
		}
	}
}
```

---
## see also:

