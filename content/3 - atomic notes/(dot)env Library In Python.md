[[Technology]], [[Programming]], [[Automation Project]]

#baby

---
## Getting Started With .env Library

The dotenv library allows you to put values from a .env file as a environmental variable inside the os shell.

first in terminal, run this command to install the library
`pip install python-dotenv

create a .env file in your root directory of your project. This will include plaintext like "password = password123".
then create a .gitignore file in your root directory as well. In your .gitignore file, add ".env" as plaintext on a new line. [[(dot)env and (dot)gitignore files|See why]]. 

### importing:
```python
import os
import dotenv
from dotenv import load_dotenv

load_dotenv() # loads items in .env file as environmental var

print(os.getenv("password")) # will print "password123"
```

---
## see also:
referenced:[[(dot)env and (dot)gitignore files]]


