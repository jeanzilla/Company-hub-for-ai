# Security

## What is stored and how

| Data | How it is stored |
|---|---|
| A person's password | scrypt with its own salt. It cannot be recovered, only changed |
| Session cookie, AI token, invite link, device key | Only the SHA-256 fingerprint. The value is shown once, when it is created |
| A connector's secret | AES-256-GCM with `HUB_ENCRYPTION_KEY`, which exists only on the server |
| Log | In plain text, with no updates or deletes |

Someone who gets a copy of the database cannot sign in as anyone or read the connector secrets without the server's key.

## The encryption key

`HUB_ENCRYPTION_KEY` is 32 bytes in base64. If it is lost, the stored secrets cannot be read and have to be typed again in Connectors. Keep a copy off the server, in a password manager. There is no automatic rotation: to change the key, save the secrets again with the new key.

## Sign-in

- A password has at least 10 characters.
- 8 failures in a row with the same email lock that email for 15 minutes.
- A session lasts 30 days. The cookie is `HttpOnly`, `SameSite=Lax` and, in production, `Secure`.
- When a person's access is removed, their sessions are closed and their tokens are revoked.
- There is always at least one active person who can manage the team.
- If the administrator loses their password, `npm run admin -- their-email@company.com` gives them a new link. This needs access to the database.

## Connected AIs

- An AI's token acts with the permissions of its person's role, no more and no less.
- The permission is checked on every call, as well as when the tools are listed.
- Over OAuth: PKCE with S256 is required, the code is single-use and valid for 10 minutes, the access token lasts 8 hours, and the refresh token lasts 90 days and changes on every use.
- The person can cut any connection from "My AI".

A risk the hub does not remove: an AI with write permission on a connector can write whatever its person asks for, or whatever a malicious text it reads along the way slips in. That is why write permission is granted per connector and per role, the tool descriptions ask for confirmation before writing, and everything is recorded in the log.

## Devices

A device's key only works for its three routes: heartbeat, confirming its jobs and sending events. It gives no access to company data. If a device is lost, give it a new key or deactivate it in the Devices screen.

## What the company should know

The log stores what each person does in the hub and what their AI does on their behalf. In Spain and the rest of the European Union, the company has to inform its employees about this before starting. A page inside the hub that says what is stored, for what purpose and who can see it is a good idea. The template does not include that text because it depends on each company and its advisers.

## Before publishing

The `security-review` skill has the full list. `node scripts/check-secrets.mjs` looks for keys and personal data in the files that are about to be pushed.

## Reporting a vulnerability

If you find a security flaw in the template, open a private advisory in the Security tab of the repository on GitHub. Do not post it in a public issue.
