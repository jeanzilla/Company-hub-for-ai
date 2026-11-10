# Company hub: rules for Claude

This repository is a company's internal hub, built from the `Company-hub-for-ai` template. The people who use it do not write code. What breaks here stops their work.

## Before you start

1. Read `docs/ARCHITECTURE.md` and, if you are going to build a screen, `docs/DESIGN.md`.
2. Read `docs/STATUS.md` (what is done) and `docs/DECISIONS.md` (what was decided and why).
3. Check whether a skill in `.claude/skills/` covers the task and say in one line which one you will use: `new-hub`, `new-connector`, `new-tool`, `new-device`, `publish-hub`, `security-review`.

## The team log

Several people, each with their own AI, work on the same things. To avoid undoing each other's work:

1. Before changing something shared (a connector, a role, a tool, data in a service), search the log for a decision on that subject. If there is one, do not undo it without telling the person who made it.
2. When you finish something that matters, add it to the log with its area: `decision` (others must not undo it without talking first), `change` (something done), `project` (a project starts or ends) or `note` (useful information). One line per item, written so any coworker understands it.
3. Never put keys or customers' personal data in the log.

If the hub's MCP server is connected, use `log_search` and `log_add`. If it is not, ask the person to connect it from the "My AI" screen.

## Secrets

1. Service secrets live in the Connectors screen, encrypted. Do not ask for them in the chat, do not print them, and do not write them to a file in the repository, a commit or the log.
2. To call a service, use `connector_request` or `callConnector()` from `lib/connectors.ts`. The server adds the secret.
3. `.env.local` is not pushed to Git. If a new variable is needed, add it to `.env.example` with no value and tell the person where to set it.
4. Real data about customers or employees does not go in tests, examples or commits. To test, use made-up data and `npm run demo`.

## Code rules

1. Every page in `app/(hub)` and every server action starts with `await requireAccess("permission")` from `lib/session.ts`. An API route that does not use a session checks its token or its key on the first line.
2. Use the database through `query()` and `queryOne()` from `lib/db.ts`, always with parameters (`$1`, `$2`). Never paste text from a person into the SQL.
3. Every table change is a new, numbered file in `db/migrations/`. Every new table has `enable row level security`. Migrations that have already been applied are not edited.
4. Anything that changes something shared is recorded with `writeLog()` from `lib/log.ts`. MCP tools are logged automatically.
5. Colors come from the variables in `app/globals.css`. No literal color in a screen.
6. Text in the language the company works in, understood at first read, without jargon. The unusual detail goes behind a link.
7. Imports inside `lib/`, `tools/` and `scripts/` keep the `.ts` extension, because the tests load them with Node without compiling.

## Before calling something done

1. `npm run check` (types, eslint and tests) with no errors.
2. Try it in `npm run demo` the way the person would: on desktop and at 390 px wide.
3. `node scripts/check-secrets.mjs` before every commit.
4. Update `docs/STATUS.md` and, if a decision was made, `docs/DECISIONS.md` with the date.

## Several sessions at once

If two Claude sessions work on the same repository, each one works in its own copy: `scripts/sessions/new.sh <topic>` creates `../<folder>-<topic>` with its own branch, `scripts/sessions/merge.sh <topic>` merges it into `main` and `scripts/sessions/close.sh <topic>` deletes it. The database is shared: announce a table change in the log before applying it.
