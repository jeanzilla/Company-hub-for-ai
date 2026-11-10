---
name: new-device
description: Connects a physical device on the premises (label printer, card reader, camera, sensor, display) to the hub through a small program that calls the hub. Use it when someone asks to print from the hub, clock in with a card, receive alarms or control any device.
---

# New device

Devices call the hub every 15 seconds, and the hub never calls a device. So there is no port to open on the premises router and nothing needs a fixed address.

Each device has a program behind it, the agent, which runs on a computer or a Raspberry Pi next to it. `devices/agent.mjs` is the example agent: a single file, with nothing to install except Node 18 or later.

## Steps

1. Ask what the device is, where it is, which computer it is plugged into and what it has to do: receive jobs (print, open, display), send events (a card read, an alarm) or both.
2. Find out how that device is driven from that computer. A printer, with the system print command (`lp` on Mac and Linux). A USB reader usually types like a keyboard. A camera or a sensor usually has an address on the local network. Try it by hand on that computer before touching the hub.
3. Register the device in the hub: Devices → Add a device. The hub shows the key only once. The person copies it to the device's computer. Do not paste it in the chat or in the repository.
4. Copy `devices/agent.mjs` to that computer and change two functions:
   - `doJob(job)`: what the device does with each `kind` of job. It returns a short text, or throws an error if it fails.
   - `status()`: what is worth seeing on the Devices screen (paper, temperature, version).
   To send events, call `sendEvent(kind, data)` when something happens.
5. Start it: `HUB_URL=https://... HUB_DEVICE_KEY=dev_... node agent.mjs`. On the Devices screen it must show "Online".
6. Press "Send a test job" and check that the device does it and that the job moves to "Done".
7. Set it up as a service, so it starts by itself when the computer is turned on and comes back up if it crashes: `launchd` on Mac, `systemd` on Linux or a scheduled task on Windows. The key goes in the service configuration, readable only by the service's user.
8. Grant the permission `device:<slug>:use` to the roles that should send it jobs, add the new device to the log and update `docs/STATUS.md`.

## How a job travels

A person, their AI or a company tool calls `enqueueJob(slug, kind, payload, requestedBy)`. The job is "Queued". On its next heartbeat the agent receives it and the job moves to "Delivered". The agent does it and confirms: "Done" or "Error". If the agent does not confirm within 5 minutes, the hub delivers the job again, up to 5 times. That is why the agent remembers for 48 hours the jobs it has already done and does not print the same label twice.

You define the `kind` and the `payload`: they are the contract between whoever enqueues the job and the agent. Write that contract in a comment at the top of the agent and in the description of the tool that enqueues.

## Events

An event is something that happens on the premises and that the hub should know about: `sendEvent("read", { card: "04A1B2" })`. It is stored in `device_events`. To make it do something (clock a person in, warn about an alarm), write a company tool that reads that table, with the `new-tool` skill.

If the agent loses its connection, have it save the events to a file and send them when the connection is back, with the time they happened inside `data`.

## Security

- One key per device. The key only allows sending heartbeats, confirming the device's own jobs and sending events.
- If the device's computer is lost or replaced: Devices → New key. The old key stops working at once.
- An agent does not execute commands that arrive in the payload of a job. `doJob` recognizes fixed kinds and treats the payload as data.
- Cameras and readers collect data about people. Before connecting them, the company tells its team what is stored and why.

## Check

1. "Online" on the Devices screen, with "Last signal" less than 15 seconds ago.
2. The test job comes out of the device and ends as "Done".
3. Stop the agent, send a job and start the agent again: it does the job on startup, only once.
4. Restart the device's computer: the agent starts by itself.
