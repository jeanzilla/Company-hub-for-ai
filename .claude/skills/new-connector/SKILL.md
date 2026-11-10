---
name: new-connector
description: Connects an outside service (accounting, CRM, telephony, shipping, bank, online shop) to the hub, storing its secret encrypted and granting permissions by role. Use it when someone asks to connect a service, to store an API key, or to let the AI look up data in an application.
---

# New connector

A connector stores the address of a service's API and its secret, encrypted. From then on, people with permission and their AIs use the service without seeing the key, and every call is written to the log.

## Steps

1. Ask which service it is and what they want to use it for from the hub: what they want to look up and what they want to change. That decides the permissions.
2. Find the documentation of its API. You need three facts: the base address (for example `https://api.service.com/v1`), how a call is authenticated, and a simple read path to test with.
3. Choose the authentication type:
   - "Authorization: Bearer header" if the documentation says `Authorization: Bearer <key>`.
   - "Another header" if the key goes in a header with a different name (`X-Api-Key`, `key`, `apikey`). Enter that name.
   - "Parameter in the URL" if it goes as `?api_key=<key>`. Enter the name of the parameter.
   - "Username and password (Basic)" if it asks for basic authentication. The secret is written as `username:password`.
4. Tell the person where to get the key in that service and ask them to paste it into the hub themselves: Connectors → Add a connector → Secret. Do not ask for it in the chat. If they paste it in the chat by mistake, tell them to change it in the service.
5. Write the description with care. The AI reads it to decide when to use the connector. Say what data is there, the two or three most useful paths, and what it must not do without confirmation.
6. Test with a read: `connector_request` with the simple path from step 2. A 200 response with data is the proof. A 401 or 403 usually means the wrong authentication type or a key without permissions.
7. Grant the permissions in Team → Roles: `connector:<slug>:read` to people who look things up and `connector:<slug>:write` only to people who must change data.
8. Add the change to the log and update `docs/STATUS.md`.

## Choosing the slug

The slug is the "ID" field of the connector. Short, lowercase, and named after what the service is for the company: `accounting`, `crm`, `shop`, `telephony`. If the company has two accounts on the same service, make two connectors: `accounting-madrid` and `accounting-malaga`. The slug cannot be changed later without redoing the permissions.

## When a connector is not enough

`connector_request` gives the AI free access to the API, within read or write. Write a company tool with the `new-tool` skill when:

- a role must do one single thing (see the pending orders) and not the whole API;
- the call has company rules (a maximum discount, a required field);
- the service asks for a computed signature, two keys, or a token that expires and has to be refreshed;
- the response carries personal data that should be trimmed before it reaches the AI.

## Services without an API with a fixed key

If the service only lets you in with user OAuth (some email and advertising suites), a simple connector does not work: tokens have to be stored and refreshed. Tell the person before starting and propose a company tool.

## Check

1. In Connectors, the connector shows "Active" and the secret shows "Saved, ends in ...".
2. A read through `connector_request` returns 200.
3. A person whose role lacks the permission does not see the connector in `connectors_list`.
4. In Log, filtering by "Automatic usage", the call appears with the name of the person who made it and without the secret.
