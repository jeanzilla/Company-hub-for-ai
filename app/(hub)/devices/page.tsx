import { requireAccess } from "@/lib/session.ts";
import { isOnline, listDevices, recentEvents, recentJobs } from "@/lib/devices.ts";
import { Notice, PageHeader, Field, formatDate, timeAgo } from "@/components/ui.tsx";
import { SecretForm } from "@/components/secret-form.tsx";
import { updateDevice, addDevice, rotateDeviceKey } from "../actions.ts";

const STATUS_CHIP: Record<string, string> = { pending: "chip chip-warn", delivered: "chip chip-accent", done: "chip chip-ok", error: "chip chip-bad" };
const STATUS_NAME: Record<string, string> = { pending: "Queued", delivered: "Delivered", done: "Done", error: "Error" };

export default async function Devices({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await requireAccess("devices:manage");
  const q = await searchParams;
  const [devices, jobs, events] = await Promise.all([listDevices(), recentJobs(15), recentEvents(15)]);
  const OpButton = ({ slug, op, label, danger }: { slug: string; op: string; label: string; danger?: boolean }) => (
    <form action={updateDevice}><input type="hidden" name="slug" value={slug} /><input type="hidden" name="op" value={op} /><button className={danger ? "btn btn-danger" : "btn"} type="submit">{label}</button></form>
  );
  return (
    <>
      <PageHeader title="Devices" text="Printers, scanners, cameras and other equipment on site. Each one calls the hub with its key every 15 seconds: it reports that it is running and picks up its jobs." />
      <Notice ok={q.ok} error={q.error} />
      <div className="mb-6 grid gap-3">
        {devices.map((d) => (
          <section key={d.slug} className="card card-pad">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-medium text-ink">{d.name} <span className="mono ml-1 font-normal text-faint">{d.slug}</span></h2>
                <p className="text-[13px] text-muted">{[d.kind, d.location].filter(Boolean).join(" · ")} · Last signal: {timeAgo(d.last_heartbeat_at)} · Key {d.key_prefix}</p>
                {Object.keys(d.status).length ? <p className="mono mt-1 text-muted">{JSON.stringify(d.status)}</p> : null}
              </div>
              <div className="flex items-center gap-2">
                {d.pending ? <span className="chip chip-warn num">{d.pending} queued</span> : null}
                {!d.active ? <span className="chip">Disabled</span> : isOnline(d) ? <span className="chip chip-ok">Online</span> : <span className="chip chip-bad">No signal</span>}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-start gap-2 border-t border-line pt-3">
              <OpButton slug={d.slug} op="test" label="Send a test job" />
              <SecretForm action={rotateDeviceKey} button="New key" buttonClass="btn" inline><input type="hidden" name="slug" value={d.slug} /></SecretForm>
              <OpButton slug={d.slug} op={d.active ? "deactivate" : "activate"} label={d.active ? "Disable" : "Enable"} />
              <OpButton slug={d.slug} op="delete" label="Delete" danger />
            </div>
          </section>
        ))}
        {!devices.length ? <p className="card empty-state">No devices yet. Add the first one and start its program with the key the hub gives you.</p> : null}
      </div>

      <section className="card card-pad mb-6">
        <h2 className="section-title mb-1">Add a device</h2>
        <p className="page-subtitle mb-3">The hub gives you a key. Put it in the program that runs on the device (devices/agent.mjs is the example one).</p>
        <SecretForm action={addDevice} button="Add">
          <div className="w-full sm:w-48"><Field label="ID"><input name="slug" className="field mono" required pattern="[a-z][a-z0-9_-]{1,39}" placeholder="warehouse-printer" /></Field></div>
          <div className="w-full sm:w-52"><Field label="Name"><input name="name" className="field" required placeholder="Warehouse printer" /></Field></div>
          <div className="w-full sm:w-36"><Field label="Kind"><input name="kind" className="field" placeholder="printer" /></Field></div>
          <div className="w-full sm:w-44"><Field label="Where it is"><input name="location" className="field" placeholder="Warehouse, ground floor" /></Field></div>
        </SecretForm>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card">
          <h2 className="section-title px-[18px] pb-2 pt-4">Latest jobs</h2>
          {jobs.length ? (
            <div className="table-wrap"><table className="data-table">
              <thead><tr><th>When</th><th>Device</th><th>Job</th><th>Status</th></tr></thead>
              <tbody>{jobs.map((j) => (
                <tr key={j.id}><td className="num whitespace-nowrap text-muted">{formatDate(j.created_at)}</td><td>{j.device}</td>
                  <td><span className="text-ink">{j.kind}</span><span className="block text-[12.5px] text-muted">{j.requested_by}{j.result ? ` · ${j.result}` : ""}</span></td>
                  <td><span className={STATUS_CHIP[j.status]}>{STATUS_NAME[j.status]}</span></td></tr>
              ))}</tbody>
            </table></div>
          ) : <p className="empty-state">No jobs yet.</p>}
        </section>
        <section className="card">
          <h2 className="section-title px-[18px] pb-2 pt-4">Latest events</h2>
          {events.length ? (
            <div className="table-wrap"><table className="data-table">
              <thead><tr><th>When</th><th>Device</th><th>Event</th></tr></thead>
              <tbody>{events.map((e) => (
                <tr key={e.id}><td className="num whitespace-nowrap text-muted">{formatDate(e.created_at)}</td><td>{e.device}</td>
                  <td><span className="text-ink">{e.kind}</span><span className="mono block text-muted">{JSON.stringify(e.data).slice(0, 140)}</span></td></tr>
              ))}</tbody>
            </table></div>
          ) : <p className="empty-state">No events yet.</p>}
        </section>
      </div>
    </>
  );
}
