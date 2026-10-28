import { prisma } from "@/lib/db";
import { requireStaffPage } from "@/lib/auth/staff";
import { formatDateTime } from "@/lib/format";
import { Field, Flash, PageHeader } from "@/components/admin/AdminUi";
import { createStaff, updateStaff } from "../actions";

export const metadata = { title: "Staff & agents" };

export default async function AgentsPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireStaffPage(["ADMIN"]);
  const users = await prisma.staffUser.findMany({ include: { agentProfile: true }, orderBy: [{ active: "desc" }, { name: "asc" }] });
  return (
    <div>
      <PageHeader title="Staff & agents" subtitle="Agents process orders. Managers can also reassign orders and view reports. Admins manage everything." />
      <Flash ok={sp.ok} err={sp.err} />
      <div className="card overflow-x-auto">
        <table className="table-base min-w-[980px]">
          <thead><tr><th>Name</th><th>Role</th><th>Status</th><th>2FA</th><th>Capacity</th><th>Last sign-in</th><th>Actions</th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className={u.active ? "" : "opacity-60"}>
                <td><p className="font-medium">{u.name}</p><p className="text-xs text-slate-500">{u.email}</p></td>
                <td>
                  <form action={updateStaff} className="flex gap-1">
                    <input type="hidden" name="id" value={u.id} />
                    <input type="hidden" name="op" value="role" />
                    <select name="role" defaultValue={u.role} className="input py-1 text-xs" disabled={u.id === ctx.user.id} aria-label="Role">
                      <option value="AGENT">Agent</option><option value="MANAGER">Manager</option><option value="ADMIN">Admin</option>
                    </select>
                    {u.id !== ctx.user.id && <button className="btn-outline btn-sm">Set</button>}
                  </form>
                </td>
                <td className="text-xs">{u.active ? (u.agentProfile?.availability.toLowerCase() ?? "—") : "deactivated"}</td>
                <td className="text-xs">{u.mfaEnabled ? "Enabled" : <span className="text-amber-ink">Not set up</span>}</td>
                <td>
                  <form action={updateStaff} className="flex gap-1">
                    <input type="hidden" name="id" value={u.id} />
                    <input type="hidden" name="op" value="capacity" />
                    <input name="maxActiveOrders" type="number" min={1} max={50} defaultValue={u.agentProfile?.maxActiveOrders ?? 5} className="input w-16 py-1 text-xs" aria-label="Max active orders" />
                    <button className="btn-outline btn-sm">Set</button>
                  </form>
                </td>
                <td className="text-xs">{formatDateTime(u.lastLoginAt)}</td>
                <td>
                  <div className="flex flex-wrap gap-1">
                    {u.id !== ctx.user.id && (
                      <form action={updateStaff}>
                        <input type="hidden" name="id" value={u.id} />
                        <input type="hidden" name="op" value={u.active ? "deactivate" : "activate"} />
                        <button className={u.active ? "btn-danger btn-sm" : "btn-outline btn-sm"}>{u.active ? "Deactivate" : "Reactivate"}</button>
                      </form>
                    )}
                    {u.mfaEnabled && (
                      <form action={updateStaff}>
                        <input type="hidden" name="id" value={u.id} />
                        <input type="hidden" name="op" value="reset-mfa" />
                        <button className="btn-outline btn-sm">Reset 2FA</button>
                      </form>
                    )}
                    <details>
                      <summary className="btn-outline btn-sm cursor-pointer list-none">Set password</summary>
                      <form action={updateStaff} className="mt-1 flex gap-1">
                        <input type="hidden" name="id" value={u.id} />
                        <input type="hidden" name="op" value="password" />
                        <input name="password" type="password" minLength={12} required className="input py-1 text-xs" placeholder="New password" aria-label="New password" />
                        <button className="btn-dark btn-sm">Save</button>
                      </form>
                    </details>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="card mt-6 max-w-2xl p-5">
        <h2 className="font-bold text-navy-900">Add staff member</h2>
        <form action={createStaff} className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Full name" name="name" required />
          <Field label="Work email" name="email" type="email" required />
          <label className="block">
            <span className="label">Role</span>
            <select name="role" className="input" defaultValue="AGENT"><option value="AGENT">Agent</option><option value="MANAGER">Manager</option><option value="ADMIN">Admin</option></select>
          </label>
          <Field label="Max active orders" name="maxActiveOrders" type="number" defaultValue={5} min={1} max={50} />
          <div className="sm:col-span-2">
            <Field label="Temporary password" name="password" type="password" required help="12+ characters with letters and numbers. They'll be required to set up two-factor authentication at first sign-in." />
          </div>
          <button className="btn-primary sm:col-span-2 sm:justify-self-start">Create account</button>
        </form>
      </section>
    </div>
  );
}
