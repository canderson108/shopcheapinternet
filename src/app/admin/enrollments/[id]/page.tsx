import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireStaffPage } from "@/lib/auth/staff";
import { getAgentOrderView } from "@/lib/services/views";
import { listMessages } from "@/lib/services/messages";
import { audit } from "@/lib/audit";
import { formatDate, formatDateTime, formatPhone, formatPrice } from "@/lib/format";
import { statusLabel, TERMINAL_STATUSES } from "@/lib/status";
import { Flash, PageHeader } from "@/components/admin/AdminUi";
import { StatusPill } from "@/components/agent/AgentConsole";
import { deleteCustomerData, reassign } from "../../actions";

export const metadata = { title: "Enrollment" };

export default async function AdminEnrollmentPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; err?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const ctx = await requireStaffPage(["MANAGER", "ADMIN"]);
  const exists = await prisma.enrollment.count({ where: { id } });
  if (!exists) notFound();
  const [o, messages, agents, logs, emails, consents, assignments] = await Promise.all([
    getAgentOrderView(id),
    listMessages(id, "staff"),
    prisma.staffUser.findMany({ where: { active: true, agentProfile: { isNot: null } }, include: { agentProfile: true }, orderBy: { name: "asc" } }),
    prisma.auditLog.findMany({ where: { enrollmentId: id }, include: { actorStaff: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 200 }),
    prisma.emailLog.findMany({ where: { enrollmentId: id }, orderBy: { createdAt: "desc" } }),
    prisma.consentRecord.findMany({ where: { enrollmentId: id }, orderBy: { createdAt: "asc" } }),
    prisma.agentAssignment.findMany({ where: { enrollmentId: id }, include: { agent: { select: { name: true } }, assignedBy: { select: { name: true } } }, orderBy: { assignedAt: "desc" } }),
  ]);
  await audit(prisma, { actor: ctx.actor, action: "enrollment.viewed", entityType: "Enrollment", entityId: id, enrollmentId: id });
  const closed = TERMINAL_STATUSES.includes(o.status);

  return (
    <div>
      <PageHeader
        title={`${o.customer.firstName} ${o.customer.lastName}`}
        subtitle={`${o.publicId} · submitted ${formatDateTime(o.submittedAt)}`}
        actions={<Link href={`/agent/orders/${o.id}`} className="btn-dark btn-sm">Open in agent workspace</Link>}
      />
      <Flash ok={sp.ok} err={sp.err} />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <section className="card p-5">
            <div className="flex flex-wrap items-center gap-3"><StatusPill status={o.status} provider={o.provider.name} /><span className="text-sm text-slate-500">Assigned: {o.assignedAgent?.name ?? "—"}</span></div>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="text-slate-500">Email</dt><dd>{o.customer.email}</dd></div>
              <div><dt className="text-slate-500">Phone</dt><dd>{formatPhone(o.customer.phone)}</dd></div>
              <div><dt className="text-slate-500">Service address</dt><dd>{o.service.street}{o.service.unit ? `, Unit ${o.service.unit}` : ""}, {o.service.city}, {o.service.state} {o.service.zip}</dd></div>
              <div><dt className="text-slate-500">Plan</dt><dd>{o.plan.providerName} {o.plan.name} · {formatPrice(o.advertisedPriceCents)}/mo</dd></div>
              <div><dt className="text-slate-500">Property</dt><dd>{o.property?.name ?? "—"}</dd></div>
              <div><dt className="text-slate-500">Attribution</dt><dd>{[o.referralSource, o.campaign, o.utm.source, o.utm.medium, o.utm.campaign].filter(Boolean).join(" · ") || "—"}</dd></div>
              <div><dt className="text-slate-500">Requested install</dt><dd>{o.preferredInstallDate ? formatDate(o.preferredInstallDate) : "—"}</dd></div>
              <div><dt className="text-slate-500">Confirmation</dt><dd>{o.confirmation ? `${o.confirmation.number} · ${formatPrice(o.confirmation.priceCents)}/mo · by ${o.confirmation.confirmedBy}` : "—"}</dd></div>
            </dl>
          </section>

          <section className="card p-5">
            <h2 className="mb-3 font-bold text-navy-900">Status history</h2>
            <ol className="space-y-2 text-sm">
              {o.history.map((h) => (
                <li key={h.id} className="border-l-2 border-slate-200 pl-3">
                  <p className="font-medium">{h.from ? `${statusLabel(h.from, o.provider.name)} → ` : ""}{statusLabel(h.to, o.provider.name)}</p>
                  <p className="text-xs text-slate-500">{formatDateTime(h.at)} · {h.actor}{h.note ? ` — ${h.note}` : ""}</p>
                </li>
              ))}
            </ol>
          </section>

          <section className="card p-5">
            <h2 className="mb-3 font-bold text-navy-900">Customer communication ({messages.length})</h2>
            <ul className="space-y-2 text-sm">
              {messages.map((m) => (
                <li key={m.id} className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">{m.sender === "AGENT" ? m.authorName : m.sender.toLowerCase()} · {m.kind.toLowerCase()} · {formatDateTime(m.createdAt)}</p>
                  <p className="mt-1 whitespace-pre-wrap">{m.body}</p>
                </li>
              ))}
              {messages.length === 0 && <li className="text-slate-500">No messages.</li>}
            </ul>
            <h3 className="mb-2 mt-5 text-sm font-bold text-navy-900">Emails sent</h3>
            <table className="table-base">
              <thead><tr><th>Template</th><th>Status</th><th>Provider</th><th>When</th></tr></thead>
              <tbody>
                {emails.map((e) => (
                  <tr key={e.id}><td>{e.template}</td><td>{e.status}{e.error ? <span className="block text-xs text-red-600">{e.error}</span> : null}</td><td>{e.provider}</td><td className="text-xs">{formatDateTime(e.createdAt)}</td></tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="card p-5">
            <h2 className="mb-3 font-bold text-navy-900">Internal notes</h2>
            <ul className="space-y-2 text-sm">
              {o.notes.map((n) => <li key={n.id} className="rounded-lg bg-amber-50/60 p-3"><p className="whitespace-pre-wrap">{n.body}</p><p className="mt-1 text-xs text-slate-500">{n.author} · {formatDateTime(n.at)}</p></li>)}
              {o.notes.length === 0 && <li className="text-slate-500">No notes.</li>}
            </ul>
          </section>

          <section className="card overflow-x-auto p-5">
            <h2 className="mb-3 font-bold text-navy-900">Activity log</h2>
            <table className="table-base min-w-[560px]">
              <thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Details</th></tr></thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id}>
                    <td className="whitespace-nowrap text-xs">{formatDateTime(l.createdAt)}</td>
                    <td className="text-xs">{l.actorStaff?.name ?? l.actorType.toLowerCase()}</td>
                    <td className="text-xs font-medium">{l.action}</td>
                    <td className="max-w-xs truncate font-mono text-[11px] text-slate-500">{l.metadata ? JSON.stringify(l.metadata) : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>

        <div className="space-y-6">
          <section className="card p-5">
            <h2 className="mb-3 font-bold text-navy-900">Assignment</h2>
            {closed ? (
              <p className="text-sm text-slate-500">Closed orders can&apos;t be reassigned.</p>
            ) : (
              <form action={reassign} className="space-y-3">
                <input type="hidden" name="enrollmentId" value={o.id} />
                <select className="input" name="agentId" defaultValue={o.assignedAgent?.id ?? ""} required aria-label="Assign to">
                  <option value="" disabled>Choose agent…</option>
                  <option value="__queue">Return to waiting queue</option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>{a.name} ({a.agentProfile?.availability.toLowerCase()})</option>
                  ))}
                </select>
                <input className="input" name="note" placeholder="Reason (optional)" maxLength={500} />
                <button className="btn-dark w-full">Update assignment</button>
              </form>
            )}
            <h3 className="mb-2 mt-5 text-xs font-bold uppercase text-slate-500">Assignment history</h3>
            <ul className="space-y-1 text-xs text-slate-600">
              {assignments.map((a) => (
                <li key={a.id}>{a.agent.name} · {a.reason} · {formatDateTime(a.assignedAt)}{a.assignedBy ? ` by ${a.assignedBy.name}` : " (system)"}{a.active ? " · current" : ""}</li>
              ))}
            </ul>
          </section>

          <section className="card p-5">
            <h2 className="mb-3 font-bold text-navy-900">Consent records</h2>
            <ul className="space-y-2 text-xs">
              {consents.map((c) => (
                <li key={c.id}><span className={`font-semibold ${c.granted ? "text-mint-700" : "text-slate-500"}`}>{c.granted ? "Granted" : "Declined"}</span> · {c.consentType} · v{c.consentVersion} · {formatDateTime(c.createdAt)}</li>
              ))}
            </ul>
          </section>

          {ctx.user.role === "ADMIN" && !o.piiDeleted && (
            <section className="card border-red-200 p-5">
              <h2 className="mb-2 font-bold text-red-700">Delete customer data</h2>
              <p className="mb-3 text-xs text-slate-600">Permanently erases this customer&apos;s contact details, addresses, notes, and messages (for deletion requests). Order facts are kept for reporting. Open orders are closed.</p>
              <form action={deleteCustomerData} className="space-y-2">
                <input type="hidden" name="enrollmentId" value={o.id} />
                <input className="input" name="reason" placeholder="Reason (e.g. customer request #123)" />
                <input className="input" name="confirm" placeholder="Type DELETE to confirm" required />
                <button className="btn-danger w-full">Delete personal information</button>
              </form>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
