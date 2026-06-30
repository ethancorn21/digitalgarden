2026-05-23 13:03
status: #baby
tags: [[technology]]; [[Programming]]; [[homelab]]

---
# Python Requirements(dot)txt

Requirements.txt is a way to install the necessary packages to run a python script. This way, the python dependencies and packages are automatically installed, the exact same version needed.

```bash
# generate with
pip freeze > requirements.txt

# create virtual environment then install on other machine:
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

the "-r" flag stands for "read". Meaning "read from this file".

---
## see also:

[[Python Virtual Environments]]
