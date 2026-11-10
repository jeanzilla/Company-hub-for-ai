#!/bin/bash
# Deletes the working copy of a topic and its branch, if it is already merged into main.
set -e
topic="$1"; [ -n "$topic" ] || { echo "Usage: scripts/sessions/close.sh <topic>"; exit 1; }
root="$(git worktree list --porcelain | head -1 | sed 's/^worktree //')"
cd "$root"
copy="$(dirname "$root")/$(basename "$root")-$topic"
git branch --merged main | grep -qE "^[ +*]*$topic$" || { echo "✗ \"$topic\" is not merged into main. Merge it first or delete it by hand."; exit 1; }
[ -d "$copy" ] && { rm -f "$copy/node_modules"; git worktree remove "$copy"; }
git branch -d "$topic"
echo "✓ \"$topic\" closed."
