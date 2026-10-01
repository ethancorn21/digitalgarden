2026-09-29 09:14
status: #baby
tags: [[technology]]; [[Artificial Intelligence]]

---
Local AI Agentic Loop Commands

## connect
```
#connect to harness VM
ssh agent 
```
## start new project
```
mkdir ~/projects/<name>
nano ~/projects/<name>/GOAL.md      # what you want, in your own words
agent-start <name>
```
The agent writes PLAN.md and its own tasks, builds them, then checks the result against GOAL.md before the loop stops. Edit GOAL.md any time and the next session re-plans.

## start loop on project
```
agent-start NAME                  # start (keeps running after you log out)
agent-watch NAME                  # watch it live
agent-stop NAME                   # stop after the current session
agent-stop NAME --now             # stop immediately
agent-report ~/projects/NAME      # progress per task and per session (full path, not just the name)
tail ~/projects/NAME/.agent/loop.log   # the loop's log
```


---
## see also:

