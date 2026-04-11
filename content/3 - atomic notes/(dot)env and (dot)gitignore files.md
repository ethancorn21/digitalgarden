#baby
[[Technology]], [[Programming]], [[Automation Project]]

---

.env is used to store sensitive data like passwords and API keys so that they are not hardcoded into the program. This allows for share-ability and open source projects to not have to blindly put confidential data into their source code.

.gitignore is used to tell git "do not commit these files to version control". 

inside .env you will have plain text that might look like this:```my_password = password123```

inside of the .gitignore file you will have plaintext that looks like this: ```.env```

then in your (python) program, you will import "dotenv" and "os" library. Both of these libraries will be used to get the password from the .env folder securely.

---
## see also
[[(dot)env Library In Python]]
