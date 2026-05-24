[[Programming]], [[technology]]

---
## TO DO:
- change having discord bot token in .env file
- find a way for people to use the bot without having the bot token in their computer (opsec)
- choose who to start chat with
- add headers instead of json encapsulation
	- (id)(type)(data)
- move crypto into its own file so you can repurpose it for future projects
- roll your own encryption (not relying on cryptography lib)
- chats as objects
	- keeps message channel
	- communicating users

The idea is to use discord as an underlay layer for encrypted messages. We will run a program that automatically sends messages over discord using API. The message will display into the console and then user will write back into the same console.

user1: this is my message
user2: this is my message back to you on a new line

on startup, program does a state check. Sees if there are existing public / private keys in 2 .pem files inside the /key folder. If not, program will generate the files as well as public and private keys.

both users generate key pairs for asymmetric encryption, users exchange public keys. Symmetric encryption key is then exchanged using the asymmetric system just set up. Keys will be formatted in discord beginning and ending with "[KeyExStart] & [KeyExEnd]"

messages will be formatted inside JSON. It will essentially act as encapsulation for the payload and include meta data like message type, sender, target, timestamp?.

For hybrid encryption:
- RSA for asymmetric encryption (establishing connection)
- AES for symmetric encryption (exchanging info)

libraries:
- discord.py
- cryptography
- json

project/
├── main.py            # entry point
├── init.py            # state check, key generation on first run
├── keys.py            # encryption/decryption operations
├── discord_client.py  # Discord API interaction
├── message.py         # JSON packaging and parsing
├── keys/
│   ├── .gitkeep
│   ├── private.pem    # never committed
│   └── public.pem     # never committed
├── .env               # Discord bot token, never committed
└── .gitignore         # ignores keys/*.pem and .env


image stenography? hiding info inside bits of the image

create RSA generation library : easy-RSA

users should be able to regenerate a public key from a private key, if they lose their public key currently, they would have to regenerate both keys.

- generate_keys() → generates and returns (pem_private, pem_public) as bytes
- save_keys(pem_private, pem_public) → writes those bytes to files, returns True/False
- get_keys() → reads from files, returns (private_key, public_key) as usable key objects
- generate_keys_folder() → handles folder/file creation only, no key generation