# Decisions

Each decision with its date and its reason, newest first. A decision is changed by writing a new one. The earlier one is not deleted.

## Template decisions

- A connector's secret does not leave the server. Whoever needs to use a service asks the hub to make the call.
- The hub does not call the devices on the premises. The devices call the hub, so no ports are opened.
- The log accepts no updates or deletes, even from the administrator.
- The hub does not send emails. The administrator copies the password links and sends them.
- One install per company, with its own database.
