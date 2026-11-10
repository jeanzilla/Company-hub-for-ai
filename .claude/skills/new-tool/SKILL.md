---
name: new-tool
description: Builds a company tool in the hub (a screen and its tools for the AI), with its permission, its table and its tests. Use it when someone asks for a new screen, list, form or automation inside the hub.
---

# New tool

A hub tool is one job of the company solved in one place: a screen for people and, with the same logic, MCP tools for their AIs. Both go through the same permission and leave the same trace in the log.

The `example/` folder of this skill holds a complete, tested tool, "Issues". Copy it as a starting point: the five files sit at the same paths they would have in the project.

## Before writing code

1. Ask who will use it, what that person does by hand today, and what they want to see when they open the screen. A tool solves one job. If two jobs come up, they are two tools.
2. Search the log (`log_search`) for anything already decided about that job.
3. Check whether the data already lives in a service that has a connector. If it does, the tool reads it with `callConnector()` and does not copy it into a table of its own.
4. Say in three lines what you are going to build and wait for approval.

## The parts

Choose a short lowercase slug, for example `orders`. Everything hangs from it.

1. Permission: `tool:orders`. If reading and changing are done by different people, two permissions: `tool:orders` and `tool:orders:manage`.
2. Table, if needed: a new file in `db/migrations/` with the next number. End it with `enable row level security` and the `revoke` from the example. Apply it with `npm run migrate`.
3. Logic and AI tools: `tools/orders.ts`. The database functions are exported so the screen can use them. Below them, the array of tools defined with `defineTool({...})`.
4. Registering the tools: in `tools/index.ts`, import the array and add it to `COMPANY_TOOLS`.
5. Screen: `app/(hub)/orders/page.tsx` and `actions.ts`. The page and every action start with `await requireAccess(PERMISSION)`.
6. Menu: an entry in `menu` in `hub.config.ts` with `href`, `title`, `icon` and `permission`. If a new icon is needed, add it to `components/icon.tsx`.
7. Test: `tests/orders.test.mjs`, like the one in the example. It checks the logic and that a person without the permission does not see the tool.

## How to write an AI tool

The AI decides from the name and the description. Write them for someone who does not know the company.

- `name`: `thing_verb`, in lowercase: `orders_search`, `order_create`.
- `description`: what it does, when to use it and what not to do. If it writes or deletes, tell the AI to confirm with the person first.
- `input`: a `z.object` with `.describe()` on every field, with an example inside the text.
- Output: just enough to decide the next step. No personal data that is not needed.
- `readOnly: true` if it changes nothing. `skipLog: true` only for reads that are repeated very often.
- `area`: one of the areas in `hub.config.ts`, so the log can be filtered.
- If the permission depends on the arguments, use `permissionFor`. See `connector_request` in `lib/mcp/core.ts`.

Errors are thrown with `throw new Error("a sentence a person can understand")`. The AI receives that text.

## The screen

Follow `docs/DESIGN.md`. The minimum:

- `<PageHeader>` with one sentence that says what the screen is for, in the company's own words.
- One column, in the order of the work. No tabs.
- Forms with server actions, which go back to the page with `?ok=` or `?error=`, shown with `<Notice>`.
- An empty state that says what the first step is.
- Anything that changes shared data is written to the log with `writeLog()`.

## Using a connector from a tool

```ts
import { callConnector } from "../lib/connectors.ts";

const r = await callConnector("shop", { path: "/orders", query: { status: "pending" } });
if (r.status !== 200) throw new Error(`The shop responds ${r.status}`);
const orders = JSON.parse(r.body);
```

A company tool that calls a connector asks for its own permission (`tool:orders`), and the connector's permission is not needed. That way a role can see the pending orders without free access to the whole API of the shop.

## Using a device from a tool

```ts
import { enqueueJob } from "../lib/devices.ts";

await enqueueJob("warehouse-printer", "print", { text: "Order 102" }, person.name);
```

The events that devices send (a card read, an alarm) are in the `device_events` table.

## Check

1. `npm run check` with no errors.
2. `npm run demo`: sign in with a role that has the permission and with another that does not. The second must not see the menu entry, and typing the address by hand sends them back to Home.
3. Look at the screen at 390 px wide and in dark mode.
4. Call each tool over MCP and check the line it leaves in the log.
5. Grant the permission to the right roles in Team → Roles. Update `docs/STATUS.md` and add the change to the log.

## What not to do

- A page or an action without `requireAccess()`.
- SQL with a person's text pasted inside it. Always use parameters.
- Storing a service key in a table of the tool. Connectors exist for that.
- Touching `lib/` or the core screens to solve something for a single tool.
