import { hub } from "@/hub.config.ts";
import { requireAccess } from "@/lib/session.ts";
import { CORE_PERMISSIONS } from "@/lib/permissions.ts";
import { listPeople, listRoles, type Role } from "@/lib/people.ts";
import { listConnectors } from "@/lib/connectors.ts";
import { listDevices } from "@/lib/devices.ts";
import { COMPANY_TOOLS } from "@/tools/index.ts";
import { Notice, PageHeader, Field, formatDate } from "@/components/ui.tsx";
import { SecretForm } from "@/components/secret-form.tsx";
import { deleteRole, updatePerson, addPerson, passwordLink, saveRole } from "../actions.ts";

type Option = { permission: string; label: string };
type Group = { title: string; options: Option[] };

function RoleForm({ role, groups, known }: { role?: Role; groups: Group[]; known: Set<string> }) {
  return (
    <form action={saveRole} className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
        <Field label="ID" hint={role ? undefined : "Lowercase, no spaces"}>
          <input name="slug" className="field mono" defaultValue={role?.slug} readOnly={!!role} required pattern="[a-z][a-z0-9_-]{1,39}" placeholder="sales" />
        </Field>
        <Field label="Name"><input name="name" className="field" defaultValue={role?.name} required placeholder="Sales" /></Field>
      </div>
      <Field label="Who it is for"><input name="description" className="field" defaultValue={role?.description} placeholder="Sales reps: they handle customers and quotes" /></Field>
      {groups.map((g) => (
        <fieldset key={g.title}>
          <legend className="micro mb-2">{g.title}</legend>
          <div className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
            {g.options.map((o) => (
              <label key={o.permission} className="flex items-start gap-2 text-[13.5px]">
                <input type="checkbox" name="permission" value={o.permission} defaultChecked={role?.permissions.includes(o.permission)} className="mt-1" />
                <span>{o.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      <Field label="Other permissions" hint={'One per line. With a wildcard: "connector:*:read" lets the role read every connector.'}>
        <textarea name="other" className="field mono" defaultValue={role?.permissions.filter((p) => !known.has(p)).join("\n")} />
      </Field>
      <div><button className="btn btn-primary" type="submit">Save the role</button></div>
    </form>
  );
}


export default async function Team({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const me = await requireAccess("team:manage");
  const q = await searchParams;
  const [people, roles, connectors, devices] = await Promise.all([listPeople(), listRoles(), listConnectors(), listDevices()]);

  const groups: Group[] = [
    { title: "Hub", options: [...CORE_PERMISSIONS] },
    { title: "Company tools", options: [...new Map([...hub.menu.map((m) => [m.permission, m.title] as const), ...COMPANY_TOOLS.map((h) => [h.permission, h.title] as const)]).entries()].map(([permission, label]) => ({ permission, label })) },
    { title: "Connectors", options: connectors.flatMap((c) => [{ permission: `connector:${c.slug}:read`, label: `${c.name}: read` }, { permission: `connector:${c.slug}:write`, label: `${c.name}: write` }]) },
    { title: "Devices", options: devices.map((d) => ({ permission: `device:${d.slug}:use`, label: `${d.name}: use` })) },
  ].filter((g) => g.options.length);
  const known = new Set(groups.flatMap((g) => g.options.map((o) => o.permission)));

  return (
    <>
      <PageHeader title="Team" text="Who can sign in to the hub and with which role. The role decides which pages each person sees and what their AI can do." />
      <Notice ok={q.ok} error={q.error} />

      <section className="card mb-6">
        <h2 className="section-title px-[18px] pb-2 pt-4">People</h2>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Person</th><th>Role</th><th>Status</th><th>Last sign-in</th><th></th></tr></thead>
            <tbody>
              {people.map((p) => (
                <tr key={p.id}>
                  <td><span className="text-ink">{p.name}</span><span className="block text-[12.5px] text-muted">{p.email}</span></td>
                  <td>
                    <form action={updatePerson} className="flex items-center gap-2">
                      <input type="hidden" name="id" value={p.id} />
                      <select name="role" defaultValue={p.role} className="field" style={{ width: 170 }} aria-label={`Role of ${p.name}`}>{roles.map((r) => <option key={r.slug} value={r.slug}>{r.name}</option>)}</select>
                      <button className="btn" type="submit">Change</button>
                    </form>
                  </td>
                  <td>{!p.active ? <span className="chip chip-bad">No access</span> : p.has_password ? <span className="chip chip-ok">Active</span> : <span className="chip chip-warn">No password</span>}</td>
                  <td className="num whitespace-nowrap text-muted">{formatDate(p.last_sign_in_at)}</td>
                  <td>
                    <div className="flex flex-wrap items-start justify-end gap-2">
                      <SecretForm action={passwordLink} button="Password link" buttonClass="btn" inline><input type="hidden" name="id" value={p.id} /></SecretForm>
                      {p.id !== me.id ? (
                        <form action={updatePerson}>
                          <input type="hidden" name="id" value={p.id} /><input type="hidden" name="active" value={p.active ? "no" : "yes"} />
                          <button className={p.active ? "btn btn-danger" : "btn"} type="submit">{p.active ? "Remove access" : "Restore access"}</button>
                        </form>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card card-pad mb-6">
        <h2 className="section-title mb-1">Add a person</h2>
        <p className="page-subtitle mb-3">When you add a person, you get a link so they can set their password. The hub does not send emails: send it yourself.</p>
        <SecretForm action={addPerson} button="Add">
          <div className="w-full sm:w-56"><Field label="Email"><input name="email" type="email" className="field" required autoComplete="off" /></Field></div>
          <div className="w-full sm:w-48"><Field label="Name"><input name="name" className="field" required autoComplete="off" /></Field></div>
          <div className="w-full sm:w-44"><Field label="Role"><select name="role" className="field" defaultValue="member">{roles.map((r) => <option key={r.slug} value={r.slug}>{r.name}</option>)}</select></Field></div>
        </SecretForm>
      </section>

      <h2 className="section-title mb-3">Roles</h2>
      <div className="grid gap-3">
        {roles.map((r) => (
          <details key={r.slug} className="collapsible card">
            <summary className="card-pad flex flex-wrap items-center justify-between gap-2">
              <span><span className="font-medium text-ink">{r.name}</span><span className="ml-2 text-[13px] text-muted">{r.description}</span></span>
              <span className="chip chip-plain num">{r.people} {r.people === 1 ? "person" : "people"}</span>
            </summary>
            <div className="border-t border-line p-[18px]">
              {r.is_system ? <p className="text-[13.5px] text-muted">This role can do everything and cannot be changed. Give it only to whoever manages the hub.</p> : (
                <>
                  <RoleForm role={r} groups={groups} known={known} />
                  {!r.people ? <form action={deleteRole} className="mt-3"><input type="hidden" name="slug" value={r.slug} /><button className="btn btn-danger" type="submit">Delete the role</button></form> : null}
                </>
              )}
            </div>
          </details>
        ))}
        <details className="collapsible card">
          <summary className="card-pad font-medium text-accent">Create a role</summary>
          <div className="border-t border-line p-[18px]"><RoleForm groups={groups} known={known} /></div>
        </details>
      </div>
    </>
  );
}
