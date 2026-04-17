#!/bin/bash
cd /Users/ethan/code/projects/digitalgarden
/Users/ethan/code/projects/digitalgarden/scripts/sync.sh
git add -A
git commit -m "sync vault notes"
git push
