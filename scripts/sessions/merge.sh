#!/bin/bash
# Merges a topic branch into main. Run it from the main folder, with main clean.
set -e
topic="$1"; [ -n "$topic" ] || { echo "Usage: scripts/sessions/merge.sh <topic>"; exit 1; }
root="$(git worktree list --porcelain | head -1 | sed 's/^worktree //')"
cd "$root"
[ "$(git branch --show-current)" = "main" ] || { echo "✗ The main folder is not on main."; exit 1; }
[ -z "$(git status --porcelain)" ] || { echo "✗ main has unsaved changes. Review them first."; exit 1; }
copy="$(dirname "$root")/$(basename "$root")-$topic"
if [ -d "$copy" ] && [ -n "$(git -C "$copy" status --porcelain | grep -v '^?? node_modules$')" ]; then echo "✗ The working copy \"$topic\" has uncommitted changes."; exit 1; fi
git merge --no-ff "$topic" -m "Merge $topic"
echo "✓ \"$topic\" merged into main. Run npm run check before publishing."
