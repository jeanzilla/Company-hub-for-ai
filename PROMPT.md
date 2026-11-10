# Starter prompt

Open Claude Code in an empty folder and paste this:

```text
I want to set up my company's internal hub with the template https://github.com/jeanzilla/Company-hub-for-ai

1. Clone the template into this folder. Delete its Git history and start a new one: this will be a private repository for my company.
2. Read CLAUDE.md, docs/ARCHITECTURE.md and docs/SECURITY.md.
3. Run npm install and npm run demo, and tell me how to sign in to see the example hub.
4. Once I have seen it, follow the new-hub skill: ask me about my company and adapt the hub.

Rules for all the work:
- Do not ask me for keys or passwords in the chat. Tell me which file or which hub screen I should put them in myself.
- Before creating an account with a service or spending money, ask me.
- Explain each step in one sentence, without jargon.
```

To keep working another day on a hub that already exists, open Claude Code in its folder: `CLAUDE.md` gives it the rules and the skills guide it.
