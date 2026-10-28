import { env } from "../env";
import { formatDate, formatPrice } from "../format";

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

type Rendered = { subject: string; html: string; text: string };

function layout(opts: { preheader: string; heading: string; paragraphs: string[]; details?: [string, string][]; cta?: { label: string; url: string }; footerNote?: string }): { html: string; text: string } {
  const p = opts.paragraphs.map((x) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#1f2937">${escapeHtml(x)}</p>`).join("");
  const details = opts.details?.length
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:8px 0 18px;border:1px solid #e5e7eb;border-radius:10px;border-collapse:separate">${opts.details
        .map(
          ([k, v]) =>
            `<tr><td style="padding:10px 14px;font-size:13px;color:#6b7280;border-bottom:1px solid #f3f4f6;width:42%">${escapeHtml(k)}</td><td style="padding:10px 14px;font-size:14px;color:#111827;font-weight:600;border-bottom:1px solid #f3f4f6">${escapeHtml(v)}</td></tr>`,
        )
        .join("")}</table>`
    : "";
  const cta = opts.cta
    ? `<p style="margin:22px 0"><a href="${escapeHtml(opts.cta.url)}" style="display:inline-block;background:#0e7c66;color:#ffffff;text-decoration:none;font-weight:700;padding:13px 22px;border-radius:10px;font-size:15px">${escapeHtml(opts.cta.label)}</a></p>`
    : "";
  const html = `<!doctype html><html><body style="margin:0;background:#f4f6fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<span style="display:none;max-height:0;overflow:hidden">${escapeHtml(opts.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden">
<tr><td style="background:#0b1b3f;padding:20px 28px"><span style="color:#ffffff;font-size:18px;font-weight:800;letter-spacing:-0.2px">Shop Cheap <span style="color:#3ee6b5">Internet</span></span></td></tr>
<tr><td style="padding:28px">
<h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#0b1b3f">${escapeHtml(opts.heading)}</h1>
${p}${details}${cta}
${opts.footerNote ? `<p style="margin:16px 0 0;font-size:12px;line-height:1.5;color:#6b7280">${escapeHtml(opts.footerNote)}</p>` : ""}
</td></tr>
<tr><td style="padding:18px 28px;background:#f9fafb;font-size:12px;line-height:1.5;color:#6b7280">
Shop Cheap Internet is an independent internet shopping and enrollment service. We are not an internet provider and are not the provider's official website. Questions? Reply to this email or contact ${escapeHtml(env.supportEmail)}.
</td></tr></table></td></tr></table></body></html>`;
  const text = [
    opts.heading,
    "",
    ...opts.paragraphs,
    "",
    ...(opts.details ?? []).map(([k, v]) => `${k}: ${v}`),
    ...(opts.cta ? ["", `${opts.cta.label}: ${opts.cta.url}`] : []),
    ...(opts.footerNote ? ["", opts.footerNote] : []),
    "",
    "Shop Cheap Internet is an independent internet shopping and enrollment service, not an internet provider.",
  ].join("\n");
  return { html, text };
}

type Base = { firstName: string; publicId: string; statusUrl: string; providerName: string; planName: string };

export function enrollmentReceivedEmail(d: Base & { priceCents: number; queued: boolean }): Rendered {
  const subject = `We received your ${d.providerName} enrollment request (${d.publicId})`;
  return {
    subject,
    ...layout({
      preheader: "Your request is in. Here's what happens next.",
      heading: `Thanks, ${d.firstName} — we received your request`,
      paragraphs: [
        `Your enrollment request for ${d.providerName} ${d.planName} has been received. This is a request, not a completed order: an enrollment specialist will verify availability at your address and place the order with ${d.providerName} on your behalf.`,
        d.queued
          ? "All of our specialists are currently helping other customers. Your request is in the queue and will be picked up as soon as someone is available."
          : "A specialist has been assigned and will begin working on your request shortly.",
        "You can check your status and message your specialist at any time using the secure link below.",
      ],
      details: [
        ["Reference", d.publicId],
        ["Plan requested", `${d.providerName} ${d.planName}`],
        ["Advertised price", `${formatPrice(d.priceCents)}/mo`],
      ],
      cta: { label: "View my enrollment status", url: d.statusUrl },
      footerNote: "Advertised pricing and availability are confirmed by the provider when your order is placed. This secure link expires in 14 days; you can request a new one from our website.",
    }),
  };
}

export function agentAssignedEmail(d: Base & { agentFirstName: string }): Rendered {
  return {
    subject: `Your enrollment specialist has been assigned (${d.publicId})`,
    ...layout({
      preheader: `${d.agentFirstName} is handling your request.`,
      heading: `${d.agentFirstName} is working on your request`,
      paragraphs: [
        `${d.agentFirstName}, one of our enrollment specialists, has been assigned to your ${d.providerName} ${d.planName} request. They may message you on your status page if they need anything.`,
      ],
      details: [["Reference", d.publicId]],
      cta: { label: "Open my status page", url: d.statusUrl },
    }),
  };
}

export function infoRequestedEmail(d: Base & { question: string }): Rendered {
  return {
    subject: `Action needed: more information for your enrollment (${d.publicId})`,
    ...layout({
      preheader: "Your specialist needs a little more information.",
      heading: "We need a bit more information",
      paragraphs: [
        `To continue your ${d.providerName} order, your enrollment specialist needs more information:`,
        d.question,
        "Please reply on your secure status page. Do not send Social Security numbers or payment card details by email or chat.",
      ],
      details: [["Reference", d.publicId]],
      cta: { label: "Respond now", url: d.statusUrl },
    }),
  };
}

export function submittedToProviderEmail(d: Base): Rendered {
  return {
    subject: `Your order was submitted to ${d.providerName} (${d.publicId})`,
    ...layout({
      preheader: `We're waiting for ${d.providerName} to confirm.`,
      heading: `Submitted to ${d.providerName}`,
      paragraphs: [
        `Your specialist has submitted your ${d.planName} order to ${d.providerName}. We'll email you as soon as ${d.providerName} confirms the order.`,
        "Your order is not confirmed until you receive a confirmation number from us.",
      ],
      details: [["Reference", d.publicId]],
      cta: { label: "View status", url: d.statusUrl },
    }),
  };
}

export function orderConfirmedEmail(
  d: Base & { confirmationNumber: string; confirmationLabel: string; confirmedPlanName: string; confirmedPriceCents: number; installDate: Date | null },
): Rendered {
  return {
    subject: `Confirmed: your ${d.providerName} order (${d.confirmationNumber})`,
    ...layout({
      preheader: `${d.providerName} confirmed your order.`,
      heading: `Your ${d.providerName} order is confirmed`,
      paragraphs: [
        `Good news, ${d.firstName}! ${d.providerName} has confirmed your internet order. Keep this email for your records. ${d.providerName} may also contact you directly about installation.`,
      ],
      details: [
        [`${d.providerName} ${d.confirmationLabel.toLowerCase()}`, d.confirmationNumber],
        ["Plan", d.confirmedPlanName],
        ["Monthly price", `${formatPrice(d.confirmedPriceCents)}/mo`],
        ["Installation / activation", d.installDate ? formatDate(d.installDate) : `To be scheduled by ${d.providerName}`],
        ["Shop Cheap Internet reference", d.publicId],
      ],
      cta: { label: "View order details", url: d.statusUrl },
      footerNote: `Prices shown are as confirmed by your specialist and exclude taxes and fees unless stated. ${d.providerName}'s terms of service and billing apply.`,
    }),
  };
}

export function unableToCompleteEmail(d: Base & { reason?: string | null }): Rendered {
  return {
    subject: `Update on your enrollment request (${d.publicId})`,
    ...layout({
      preheader: "We weren't able to complete this order.",
      heading: "We couldn't complete this order",
      paragraphs: [
        `Unfortunately we weren't able to complete your ${d.providerName} ${d.planName} order.`,
        ...(d.reason ? [`Reason: ${d.reason}`] : []),
        "Your specialist may have left more details on your status page. Contact us and we'll help you look at other options.",
      ],
      details: [["Reference", d.publicId]],
      cta: { label: "View details", url: d.statusUrl },
    }),
  };
}

export function accessLinkEmail(d: { firstName: string; publicId: string; statusUrl: string }): Rendered {
  return {
    subject: `Your secure enrollment link (${d.publicId})`,
    ...layout({
      preheader: "Use this link to return to your enrollment.",
      heading: "Here's your secure link",
      paragraphs: [`Hi ${d.firstName}, use the button below to return to your enrollment status page. The link expires in 14 days.`, "If you didn't request this, you can ignore this email."],
      cta: { label: "Open my enrollment", url: d.statusUrl },
    }),
  };
}

export function agentNewOrderEmail(d: { agentName: string; publicId: string; planLabel: string; city: string; state: string; url: string; queued: boolean }): Rendered {
  return {
    subject: d.queued ? `Queued enrollment waiting: ${d.publicId}` : `New enrollment assigned: ${d.publicId}`,
    ...layout({
      preheader: d.queued ? "No agent was available — an enrollment is waiting." : "A new enrollment was assigned to you.",
      heading: d.queued ? "An enrollment is waiting in the queue" : `New enrollment for ${d.agentName}`,
      paragraphs: [`${d.planLabel} — ${d.city}, ${d.state}. Open the agent workspace to process it.`],
      details: [["Reference", d.publicId]],
      cta: { label: "Open agent workspace", url: d.url },
    }),
  };
}

export function agentCustomerReplyEmail(d: { agentName: string; publicId: string; url: string }): Rendered {
  return {
    subject: `Customer replied: ${d.publicId}`,
    ...layout({
      preheader: "A customer sent a new message.",
      heading: "New customer message",
      paragraphs: [`The customer on ${d.publicId} sent a new message while you were away.`],
      cta: { label: "Open conversation", url: d.url },
    }),
  };
}
