#!/usr/bin/env node
// Example program for a device. It runs on the computer (or Raspberry Pi) the machine is plugged into.
// It needs nothing installed besides Node 18 or later: copy this file and start it with
//
//   HUB_URL=https://your-hub.com HUB_DEVICE_KEY=dev_… node agent.mjs
//
// Every 15 seconds it calls the hub (heartbeat), collects the pending jobs, does them and confirms each one.
// The hub never calls the premises: there are no ports to open and no router to configure.
// Replace doJob() with whatever your machine does. The "new-device" skill guides you.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const HUB = (process.env.HUB_URL || "").replace(/\/+$/, "");
const KEY = process.env.HUB_DEVICE_KEY || "";
if (!HUB || !KEY) { console.error("Missing HUB_URL and HUB_DEVICE_KEY."); process.exit(1); }

// Jobs already done, so that one is not repeated if its confirmation got lost on the way (kept for 48 hours).
const doneFile = path.join(os.tmpdir(), `hub-agent-${KEY.slice(4, 12)}.json`);
let done = {};
try { done = JSON.parse(fs.readFileSync(doneFile, "utf8")); } catch { /* first run */ }
const remember = (id) => {
  done[id] = Date.now();
  for (const [k, t] of Object.entries(done)) if (Date.now() - t > 48 * 3600000) delete done[k];
  fs.writeFileSync(doneFile, JSON.stringify(done));
};

/** What the machine does with each job. Returns a short text with the result; if it fails, it throws an error. */
async function doJob(job) {
  if (job.kind === "test" || job.kind === "print") {
    // The real command would go here, for example: execFile("lp", ["-d", "Printer", file]).
    console.log(`  → ${job.kind}: ${JSON.stringify(job.payload)}`);
    return "Done by the example agent";
  }
  throw new Error(`This machine does not know how to do "${job.kind}"`);
}

/** Data about the machine shown on the Devices page (paper, ink, temperature…). */
function status() {
  return { host: os.hostname(), agent: "example 1.0" };
}

async function call(route, body) {
  const r = await fetch(`${HUB}${route}`, {
    method: "POST", headers: { "content-type": "application/json", "x-device-key": KEY },
    body: JSON.stringify(body), signal: AbortSignal.timeout(20000),
  });
  if (r.status === 401) { console.error("The hub does not accept the key. Check HUB_DEVICE_KEY or ask for a new one on the Devices page."); process.exit(1); }
  if (!r.ok) throw new Error(`The hub answered ${r.status}`);
  return r.json();
}

/** To tell the hub about something that happens on the premises: await sendEvent("scan", { card: "04A1…" }) */
export const sendEvent = (kind, data) => call("/api/devices/events", { kind, data });

async function round() {
  const { jobs = [], next_in = 15 } = await call("/api/devices/heartbeat", { status: status() });
  for (const job of jobs) {
    if (done[job.id]) { await call(`/api/devices/jobs/${job.id}`, { ok: true, result: "Already done" }); continue; }
    try {
      const result = await doJob(job);
      remember(job.id);
      await call(`/api/devices/jobs/${job.id}`, { ok: true, result });
    } catch (e) {
      await call(`/api/devices/jobs/${job.id}`, { ok: false, result: String(e.message || e) }).catch(() => {});
    }
  }
  return next_in;
}

console.log(`Agent connected to ${HUB}. Ctrl+C to stop.`);
for (;;) {
  let wait = 15;
  try { wait = await round(); } catch (e) { console.error(`No connection to the hub (${e.message}). Retrying in 15 s.`); }
  await new Promise((ok) => setTimeout(ok, wait * 1000));
}
