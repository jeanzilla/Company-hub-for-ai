#!/bin/bash
# Opens a working copy for a topic: ../<folder>-<topic>, with its own branch. Two sessions then never overwrite each other.
set -e
topic="$1"; [ -n "$topic" ] || { echo "Usage: scripts/sessions/new.sh <topic>"; exit 1; }
root="$(git worktree list --porcelain | head -1 | sed 's/^worktree //')"
copy="$(dirname "$root")/$(basename "$root")-$topic"
git -C "$root" worktree add "$copy" -b "$topic" main
[ -f "$root/.env.local" ] && cp "$root/.env.local" "$copy/.env.local"
[ -d "$root/node_modules" ] && ln -s "$root/node_modules" "$copy/node_modules"
echo "✓ Working copy at $copy (branch \"$topic\"). When you finish: scripts/sessions/merge.sh $topic"
