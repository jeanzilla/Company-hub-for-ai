---
name: publish-hub
description: Publishes the hub on the internet (Vercel and a Postgres database) and publishes every later change with checks before and after. Use it when someone asks to put the hub in production, give it a domain or deploy changes.
---

# Publish the hub

There are two different moments: the first publication, which is done once, and every later publication, which is short.

Before creating an account on a service or choosing a paid plan, ask. The person creates the accounts, with their own email.

## First publication

1. Run the `security-review` skill. Nothing is published while something is pending there.
2. Private repository. With the person, create a private repository in their GitHub account and push `main`. Check first that `.env.local` and `.demo/` do not appear in `git status`.
3. Production database. It is a different database from the test one. On Supabase, use the "Transaction pooler" connection string (port 6543).
4. Variables. Generate a new `HUB_ENCRYPTION_KEY` for production, different from the test one, and have the person save it in their password manager.
5. Tables and first person, from your terminal and against the production database, without writing the connection string in any file of the repository:
   ```bash
   DATABASE_URL='...' npm run migrate
   DATABASE_URL='...' HUB_URL='https://hub.company.com' npm run admin -- you@company.com "Name"
   ```
   Have the person paste the connection string into their terminal. Do not ask for it in the chat.
6. Vercel project. The person imports the repository from vercel.com and sets the variables in Settings → Environment Variables, in "Production" only: `DATABASE_URL`, `HUB_ENCRYPTION_KEY` and `HUB_URL`. Choose a region close to the database.
7. Domain. In Vercel → Domains, add `hub.company.com` and create at their domain provider the DNS record that Vercel indicates. Once it works, `HUB_URL` must be exactly that address, with no trailing slash, and the project has to be deployed again.
8. Check (list below) and add an entry to the log, as `project`: "Hub published at https://...".

The hub runs anywhere that runs Next.js on Node. If the company prefers another host, steps 6 and 7 change and the rest stays the same.

## Sign-in with Google, if they want it

1. In Google Cloud Console, the person creates a project and an OAuth client of type "Web application".
2. Authorized redirect URI: `https://hub.company.com/auth/google/callback`.
3. Variables `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in Vercel, then deploy again.

Only a person registered in Team with that email can sign in with Google. The password keeps working.

## Every later publication

1. `npm run check` with no errors.
2. `node scripts/check-secrets.mjs`.
3. If there are new migrations, apply them to production before pushing the code: `DATABASE_URL='...' npm run migrate`. A migration that drops or changes a column used by code that is already published takes two publications: first the code that stops using the column, then the migration.
4. `git push` to `main`. Vercel deploys by itself.
5. Check and add the change to the log.

## Checks after publishing

1. `https://hub.company.com/api/health` responds `{"ok":true}`.
2. Sign in as a person and open the screen you changed.
3. `curl -s -o /dev/null -w "%{http_code}" -X POST https://hub.company.com/api/mcp` responds 401.
4. If there are devices, they still show "Online" on the Devices screen.
5. If something fails: in Vercel → Deployments, use "Promote" on the previous deployment. Fix the problem afterwards, without hurry.

## Backups

Ask what backups their Postgres provider makes and how often. The log and the encrypted secrets are in that database. The `HUB_ENCRYPTION_KEY` is not in the database: without it, a restored backup cannot read the connector secrets.

## What not to do

- Put a key in a file of the repository, even "just for a moment".
- Use the same database for testing and for production.
- Apply to production a migration that has not been tried in `npm run demo`.
- Publish on a Friday afternoon something that touches sign-in or permissions.
