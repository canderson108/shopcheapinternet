import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireStaffPage } from "@/lib/auth/staff";
import { Check, Field, Flash, PageHeader, TextArea } from "@/components/admin/AdminUi";
import { saveProvider, saveServiceAreas } from "../../actions";

export const metadata = { title: "Provider" };

export default async function ProviderEditPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; err?: string }> }) {
  await requireStaffPage(["ADMIN"]);
  const { id } = await params;
  const sp = await searchParams;
  const isNew = id === "new";
  const p = isNew ? null : await prisma.provider.findUnique({ where: { id } });
  if (!isNew && !p) notFound();
  const zips = p ? await prisma.serviceArea.findMany({ where: { providerId: p.id }, select: { zip: true }, orderBy: { zip: "asc" } }) : [];

  return (
    <div className="max-w-4xl">
      <PageHeader title={p ? p.name : "Add provider"} subtitle="Provider configuration drives plans, the agent order portal button, and confirmation wording." />
      <Flash ok={sp.ok} err={sp.err} />
      <form action={saveProvider} className="card grid gap-4 p-5 sm:grid-cols-2">
        {p && <input type="hidden" name="id" value={p.id} />}
        <Field label="Name" name="name" defaultValue={p?.name} required />
        <Field label="URL slug" name="slug" defaultValue={p?.slug} required help="Used in /providers/{slug}" />
        <Field label="Logo URL (https)" name="logoUrl" defaultValue={p?.logoUrl} help="Only use a logo you're licensed to display." />
        <Field label="Provider website" name="websiteUrl" defaultValue={p?.websiteUrl} />
        <Field label="Order portal name" name="portalName" defaultValue={p?.portalName} placeholder="AT&T SPOC" />
        <Field
          label="Order portal entry URL (https)"
          name="orderPortalUrl"
          defaultValue={p?.orderPortalUrl}
          help="The authorized sign-in / landing URL for agents. Don't paste URLs containing a session ID — those expire."
        />
        <Field label="Confirmation number label" name="confirmationNumberLabel" defaultValue={p?.confirmationNumberLabel ?? "Confirmation number"} required />
        <Field label="Sort order" name="sortOrder" type="number" defaultValue={p?.sortOrder ?? 0} />
        <div className="sm:col-span-2"><TextArea label="Agent order-entry instructions" name="orderInstructions" defaultValue={p?.orderInstructions} rows={5} help="Shown in the agent workspace next to the portal button." /></div>
        <div className="sm:col-span-2"><TextArea label="Enrollment requirements" name="enrollmentRequirements" defaultValue={p?.enrollmentRequirements} help="E.g. credit check / ID verification handled in the provider's own process." /></div>
        <div className="sm:col-span-2"><TextArea label="Confirmation workflow" name="confirmationWorkflow" defaultValue={p?.confirmationWorkflow} help="Where agents find the confirmation number and what counts as confirmed." /></div>
        <div className="sm:col-span-2"><TextArea label="Public disclosure" name="disclosure" defaultValue={p?.disclosure} help="Shown on the provider's public page." /></div>
        <Check label="Shown on the website" name="active" defaultChecked={p?.active ?? true} />
        <Check label="Orderable (appears in the enrollment funnel)" name="orderable" defaultChecked={p?.orderable ?? false} help="Requires an order portal URL. Leave off for providers you can't process yet." />
        <button className="btn-primary sm:col-span-2 sm:justify-self-start">Save provider</button>
      </form>

      {p && (
        <form action={saveServiceAreas} className="card mt-6 space-y-3 p-5">
          <input type="hidden" name="providerId" value={p.id} />
          <h2 className="font-bold text-navy-900">Advertised service area ZIP codes ({zips.length})</h2>
          <p className="text-sm text-slate-600">
            Optional. When set, {p.name} plans only show for these ZIPs and are labeled &quot;advertised in your ZIP&quot;. This is never treated as confirmed
            serviceability at an address. Leave empty to show plans everywhere as &quot;availability not yet confirmed&quot;.
          </p>
          <textarea name="zips" rows={6} className="input font-mono text-xs" defaultValue={zips.map((z) => z.zip).join(", ")} placeholder="75201, 75202, 75204" />
          <button className="btn-outline">Replace ZIP list</button>
        </form>
      )}
    </div>
  );
}
