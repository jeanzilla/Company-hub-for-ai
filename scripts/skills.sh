#!/bin/bash
# Installs in this project the skills by other authors that the template recommends (docs/SKILLS.md).
# They are downloaded from their source repository. An internet connection is needed.
set -e
cd "$(dirname "$0")/.."
add_skills() { repo="$1"; shift; args=(); for s in "$@"; do args+=(-s "$s"); done; npx -y skills@latest add "$repo" "${args[@]}" -a claude-code -y --copy; }

add_skills obra/superpowers brainstorming writing-plans systematic-debugging verification-before-completion
add_skills anthropics/skills frontend-design mcp-builder
add_skills vercel-labs/agent-skills vercel-react-best-practices web-design-guidelines
add_skills accesslint/claude-marketplace accessibility-audit accessibility-fix
add_skills addyosmani/agent-skills code-review-and-quality
add_skills pbakaus/impeccable impeccable
echo "Done. The skills are in .claude/skills/."
