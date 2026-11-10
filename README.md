# Company hub

A template for setting up a company's internal hub: one place where the people on the team sign in, each with a role, and where the services the company uses, the devices on its premises and each employee's AI are connected.

Claude Code builds it and extends it. The template ships with the core built and tested, and six skills that guide Claude through adapting it to each company.

## What it includes

- Sign-in with email and password, and with Google if it is configured. People are added in Team and get a link to set their password.
- Roles with permissions. A role decides which screens the person sees and which tools their AI has.
- Connectors. Each outside service is stored with its secret encrypted (AES-256-GCM). The hub makes the calls: the secret never reaches the browser or the AI, and if a service returns it in a response, the hub masks it.
- An MCP server at `/api/mcp`. A person connects their AI with the hub's URL (OAuth 2.1 with PKCE) or with a personal token. The AI sees only the tools of the role.
- Log. Every call from an AI or a device is recorded with person, tool and time. People and their AIs also add decisions, changes, projects and notes. The table rejects updates and deletes.
- Physical devices. A printer, a card reader or a camera calls the hub every 15 seconds with its key, picks up jobs and sends events. No ports need to be opened on the premises.
- A demo that runs without creating any account: `npm run demo`.

## Try it in a minute

Requires Node 22.18 or later.

```bash
git clone https://github.com/jeanzilla/Company-hub-for-ai.git
cd Company-hub-for-ai
npm install
npm run demo
```

Open http://localhost:3000 and sign in as `ana@demo.test` or `luis@demo.test`, password `demo-demo-demo`. The demo starts a Postgres inside Node, with made-up data, an example connector and a fake printer. The data is kept in `.demo/`.

## Set up your company's hub

Open Claude Code in an empty folder and paste the text from [PROMPT.md](PROMPT.md). Claude clones the template, shows you the demo and follows the `new-hub` skill: it asks about your company, creates the roles and the connectors, and publishes the hub.

By hand it takes five steps:

1. A Postgres database. Supabase, Neon or your own all work. On Supabase, use the "Transaction pooler" connection string.
2. Copy `.env.example` to `.env.local` and fill in `DATABASE_URL`, `HUB_ENCRYPTION_KEY` and `HUB_URL`.
3. `npm run migrate` creates the tables.
4. `npm run admin -- you@company.com "Your name"` creates the first person and prints the link to set their password.
5. `npm run dev` locally, or publish to Vercel with the `publish-hub` skill.

## How it is built

Next.js 16 (App Router), React 19, Tailwind 4 and Postgres with `postgres.js`. No external authentication service: passwords are hashed with scrypt and sessions are stored in a table.

```
app/(hub)/            signed-in screens: home, log, my-ai, team, connectors, devices
app/api/mcp/          the hub's MCP server
app/api/devices/      the routes that devices call
app/api/oauth/        one-click connection for an AI
lib/                  session, permissions, encryption, connectors, devices, log and MCP
tools/                the company's own tools for the MCP server
devices/              example program for a device
db/migrations/        SQL, in order
hub.config.ts         company name, color, areas and menu
.claude/skills/       the template's six skills
```

More detail in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/SECURITY.md](docs/SECURITY.md) and [docs/DESIGN.md](docs/DESIGN.md).

## Skills

- `new-hub`: from the template to a company's hub.
- `new-connector`: connect an outside service.
- `new-tool`: a screen and its AI tools for one of the company's jobs.
- `new-device`: connect a device on the premises.
- `publish-hub`: put the hub on the internet.
- `security-review`: checklist to run before publishing.

`scripts/skills.sh` also installs twelve skills by other authors that help Claude plan, design and debug. The list and its sources are in [docs/SKILLS.md](docs/SKILLS.md).

## What is tested and what is not

`npm test` runs 16 tests against a real Postgres (PGlite): sign-in, lockout after 8 failures, roles, a log that cannot be deleted, connectors that do not leak the secret, the device queue and the MCP server with permissions per role.

Tested by hand in the demo: password sign-in, the six screens on desktop and on mobile, connecting an AI over OAuth from start to finish with a test client, and the example device program.

Not tested yet: Google sign-in, an install against Supabase or Neon in production, and connecting from the Claude app (the OAuth flow was tested with a hand-written client, not with Claude). If you test any of these, open an issue with what you find.

## License

MIT. The skills by other authors are not in this repository: `scripts/skills.sh` downloads them from their source and each one has its own license.
