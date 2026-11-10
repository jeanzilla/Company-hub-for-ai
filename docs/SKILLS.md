# Skills

A skill is a file of instructions that Claude Code reads when the task fits. Skills are in `.claude/skills/<name>/SKILL.md`.

## The template's skills

| Skill | When |
|---|---|
| `new-hub` | At the start: turns the template into a company's hub |
| `new-connector` | To connect an outside service |
| `new-tool` | To build a screen and its AI tools |
| `new-device` | To connect a device on the premises |
| `publish-hub` | To put the hub on the internet and for every later release |
| `security-review` | Before publishing and after touching permissions, connectors or sign-in |

## Skills by other authors

`scripts/skills.sh` downloads these twelve from their source repository with the `skills` tool by Vercel Labs. They are not inside the template: each one has its own author and its own license.

| Skill | Source | What for |
|---|---|---|
| brainstorming | obra/superpowers | Clarify what is wanted before building |
| writing-plans | obra/superpowers | Write the plan for a job with several steps |
| systematic-debugging | obra/superpowers | Find the cause of a failure before fixing it |
| verification-before-completion | obra/superpowers | Check before saying it is done |
| frontend-design | anthropics/skills | Design screens |
| mcp-builder | anthropics/skills | Write good MCP tools |
| vercel-react-best-practices | vercel-labs/agent-skills | React and Next.js |
| web-design-guidelines | vercel-labs/agent-skills | Review an interface |
| accessibility-audit | accesslint/claude-marketplace | Review accessibility |
| accessibility-fix | accesslint/claude-marketplace | Fix what the previous one finds |
| code-review-and-quality | addyosmani/agent-skills | Review code |
| impeccable | pbakaus/impeccable | Polish the design |

To add another: `npx skills add <author>/<repository> -s <name> -a claude-code -y --copy`. Before installing a skill by an author you do not know, read its `SKILL.md`: these are instructions that Claude will follow.

## Writing your own

When the company repeats a job (preparing a quote, checking an invoice, answering one type of customer), the job deserves a skill. Create `.claude/skills/<name>/SKILL.md` with this header and, below it, the steps:

```markdown
---
name: lowercase-name
description: What it does and when to use it, in one or two sentences. Claude decides with this text.
---
```

Say which steps to follow, which hub tools to use and what never to do. Include a real example with made-up data.
