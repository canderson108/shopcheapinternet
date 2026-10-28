import type { Metadata } from "next";
import { SiteShell } from "@/components/SiteChrome";
import { FunnelSteps } from "@/components/FunnelSteps";
import { EnrollmentStatusClient } from "@/components/EnrollmentStatusClient";
import { RequestLinkForm } from "@/components/RequestLinkForm";
import { customerEnrollmentId } from "@/lib/customer-access";
import { getCustomerView } from "@/lib/services/views";
import { listMessages, markRead } from "@/lib/services/messages";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Enrollment status", robots: { index: false, follow: false } };

export default async function EnrollmentStatusPage({ params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  const id = await customerEnrollmentId(publicId);

  if (!id) {
    return (
      <SiteShell>
        <div className="container-page max-w-lg py-16">
          <h1 className="text-2xl font-extrabold text-navy-900">Open your enrollment securely</h1>
          <p className="mt-2 text-slate-600">
            For your privacy, enrollment details are only shown in the browser you used to enroll or through the secure link we email you.
            Enter the email address you enrolled with and we&apos;ll send a new link.
          </p>
          <div className="mt-6">
            <RequestLinkForm />
          </div>
        </div>
      </SiteShell>
    );
  }

  const [view, messages] = await Promise.all([getCustomerView(id), listMessages(id, "customer")]);
  await markRead(id, "customer");

  return (
    <SiteShell>
      <FunnelSteps current={3} />
      <EnrollmentStatusClient initialView={view} initialMessages={messages} />
    </SiteShell>
  );
}
