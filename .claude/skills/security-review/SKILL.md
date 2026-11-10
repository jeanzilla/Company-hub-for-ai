---
name: security-review
description: Security checklist for the hub. Use it before publishing, after touching sign-in, permissions, connectors or the MCP, and before sharing the repository with someone outside the company.
---

# Security review

Go through the whole list and give the result item by item: pass, fail (with the file and the line) or not applicable. Do not fix anything before saying what you found.

## 1. Nothing secret in the repository

1. `node scripts/check-secrets.mjs` with no warnings.
2. `git status` does not show `.env.local`, `.demo/` or files with data exported from a service.
3. `git log -p -S"postgresql://" --all | head` and the same with `Bearer ` and `sk-`: no key in the history. If one appears, that key is changed in its service. Deleting it from the file is not enough.
4. In `docs/`, in the tests and in the examples there are no names, phone numbers or emails of real customers or employees.

## 2. Every door has its check

1. Pages: `grep -L "requireAccess(" $(find "app/(hub)" -name "page.tsx")` returns nothing.
2. Actions: in every `actions.ts` file, every exported function calls `requireAccess()` before reading or writing.
3. API routes: every `route.ts` under `app/api` checks a token (`personFromToken`), a device key (`callingDevice`) or is public on purpose (`health`, `oauth`, `.well-known`). A new route added to `PUBLIC_PATHS` in `proxy.ts` needs its own check inside.
4. MCP tools: each one declares `permission`. None uses `visible: () => true` except `hub_whoami`.

## 3. Database

1. Every query uses parameters. Look for pasted text: ``grep -rn 'query(`' lib tools app | grep '\${'`` and review each result. Only fixed names written in the code may be interpolated, never a value that comes from a person or from an AI.
2. Every table has RLS: the test "every table has RLS enabled" passes.
3. No applied migration has been edited: `git log --oneline -- db/migrations` shows each file created once.

## 4. Connector secrets

1. No screen, tool or log returns `secret_encrypted` or the decrypted secret. `decrypt(` appears only in `lib/connectors.ts`.
2. Calls to services go through `callConnector()`. If a company tool does its own `fetch` to a service, review where it gets the key and check that it masks the secret in the response.
3. There is no `console.log` of full responses from a service.

## 5. Permissions

1. In Team → Roles, one or two people have the admin role.
2. The write permission on each connector belongs only to the roles that must change data there.
3. Tools that write or delete ask for confirmation in their description.
4. A person who has left the company shows "No access".

## 6. Data about people

1. The team has been told that the hub stores what each person does and what their AI does.
2. The log carries no personal data about customers in titles or details. Look at the last 50 lines.
3. Device events that identify a person (clock-ins, cameras) have a deletion period that is decided and written in `docs/DECISIONS.md`.

## 7. Production

1. `HUB_URL` is the real address, with https.
2. The production `HUB_ENCRYPTION_KEY` is different from the test one and there is a copy outside the server.
3. `curl -sI https://hub.company.com | grep -i -E "content-security|strict-transport"` shows both headers.
4. The production database does not accept unencrypted connections.

## When you finish

Write the result in `docs/STATUS.md` with the date. Anything that fails and is not fixed today goes in the log as a `note`, area Hub, with the name of the person who will fix it.
