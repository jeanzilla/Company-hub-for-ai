---
name: new-hub
description: Turns the template into the hub of one specific company. Interviews the person who commissions it, sets the name, color, areas and roles, prepares the database, creates the first person and proposes the first connectors and tools. Use it when starting a new hub or when someone asks to "set up my company's hub".
---

# New hub

The result of this skill is a hub the company can open today: with its name, its roles, its first person signed in and an agreed list of what gets connected next. Connectors, tools and devices are set up afterwards, one at a time, each with its own skill.

Talk to the person who commissions it as someone who does not write code. One question at a time. Never ask for keys or passwords in the chat.

## 1. Show before asking

1. Run `npm install` and `npm run demo`.
2. Ask them to sign in at http://localhost:3000 as `ana@demo.test` (admin) and then as `luis@demo.test` (warehouse), password `demo-demo-demo`, and to compare what each one sees.
3. Show them three things: My AI (how each employee connects their assistant), Log (who did what) and Devices.

With the example in front of them, the next questions are easier to answer.

## 2. The interview

Write the answers in `docs/COMPANY.md` (create it). No personal data about customers and no keys.

1. What the company is called and what it does, in one sentence.
2. Who will use the hub: how many people and what each group does. The roles come from this answer. Between three and six is normal.
3. Which services they use every day: accounting and invoices, CRM or WhatsApp, email, telephony, online shop, shipping, bank, ads. For each one: who uses it and what they look up most.
4. Which devices on the premises are worth connecting: label printers, time-clock readers, cameras, alarms.
5. Which three repeated jobs take the most time. The first tools come from this answer.
6. What an AI must never do without a person confirming it (pay, delete, write to a customer).
7. Who manages the hub: name and email. Two people are better than one.
8. If they already have a domain, the address they want for the hub (for example `hub.company.com`).

## 3. Configure

1. `hub.config.ts`: `name`, `description` (AIs read it when they connect), `color` (the brand color, in hexadecimal; check that white text is readable on top of it) and `areas` in the company's own words. Between six and twelve areas, including "Hub" and "Other".
2. `app/icon.svg`: change the background color to the company's color.
3. Git: if the folder comes from cloning the template, delete `.git`, run `git init` and make a first commit. The company's repository is private.
4. `bash scripts/skills.sh` installs the skills written by other authors (docs/SKILLS.md). Ask first: it downloads code from the internet.

## 4. Database and first person

1. Ask whether they already have a Postgres database. If they do not, propose Supabase or Neon and have the person create the account, with their own email. Choose a region in the European Union if the company is in Europe.
2. Copy `.env.example` to `.env.local`. Tell them what to paste on each line and where to find it. `HUB_ENCRYPTION_KEY` is generated with the command written in that file. Have them save it in their password manager too, because without it the connector secrets cannot be read.
3. `npm run migrate`.
4. `npm run admin -- you@company.com "Name"` for each person who manages the hub. Give them the link it prints so they can set their password.
5. `npm run dev` and have them sign in.

## 5. Roles

Create the roles in Team → Roles with the person next to you, or tell them how to do it. Rules:

- One role per kind of work, with the name the company uses: "Sales", "Warehouse", "Admin".
- Start small: `log:read` and `log:write`. Permissions for connectors, devices and tools are granted once those exist.
- The write permission on a connector goes only to people who already change data in that service today.
- The admin role goes to one or two people.

Then have them add two or three coworkers to test. Do not add the whole company yet.

## 6. The plan

Write in `docs/STATUS.md` the list of what comes next, in order, and agree on it with the person:

1. Publish it (skill `publish-hub`), so the team can sign in from anywhere.
2. The two connectors they use most (skill `new-connector`).
3. The first tool, for the job that takes the most time (skill `new-tool`).
4. The first device, if there is one (skill `new-device`).
5. A page that tells employees what the hub stores about what they do. Telling them before starting is mandatory. Draft it with the person and, if they have an employment law adviser, have the adviser review it.

One step at a time, and each one tested before the next.

## 7. Wrap up

1. `npm run check` and `node scripts/check-secrets.mjs`.
2. Commit.
3. Have each person who manages the hub connect their AI from My AI.
4. Add an entry to the log, as `project` in the Hub area: "The company hub starts", with the plan in the detail.

## What not to do at this stage

- Build five tools on the first day. Build one, use it for a week and then decide the next one.
- Add the whole staff before the hub has something useful in it.
- Copy into a hub table data that already lives in a service.
