import { prisma } from "../db";
import { env } from "../env";
import { lookupHash } from "../crypto";

export type OutgoingEmail = {
  to: string;
  subject: string;
  html: string;
  text: string;
  template: string;
  enrollmentId?: string | null;
};

/** In-memory outbox used when EMAIL_PROVIDER=memory (automated tests). */
export const memoryOutbox: OutgoingEmail[] = [];

type SendResult = { ok: true; id?: string } | { ok: false; error: string };

async function sendResend(msg: OutgoingEmail): Promise<SendResult> {
  if (!env.resendApiKey) return { ok: false, error: "RESEND_API_KEY not configured" };
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.resendApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: env.emailFrom,
      to: [msg.to],
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
      reply_to: env.emailReplyTo,
    }),
  });
  const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
  return res.ok ? { ok: true, id: body.id } : { ok: false, error: body.message ?? `HTTP ${res.status}` };
}

async function sendPostmark(msg: OutgoingEmail): Promise<SendResult> {
  if (!env.postmarkToken) return { ok: false, error: "POSTMARK_SERVER_TOKEN not configured" };
  const res = await fetch("https://api.postmarkapp.com/email", {
    method: "POST",
    headers: {
      "X-Postmark-Server-Token": env.postmarkToken,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      From: env.emailFrom,
      To: msg.to,
      Subject: msg.subject,
      HtmlBody: msg.html,
      TextBody: msg.text,
      ReplyTo: env.emailReplyTo,
      MessageStream: "outbound",
      Tag: msg.template,
    }),
  });
  const body = (await res.json().catch(() => ({}))) as { MessageID?: string; Message?: string };
  return res.ok ? { ok: true, id: body.MessageID } : { ok: false, error: body.Message ?? `HTTP ${res.status}` };
}

async function sendSmtp(msg: OutgoingEmail): Promise<SendResult> {
  if (!env.smtpUrl) return { ok: false, error: "SMTP_URL not configured" };
  const nodemailer = await import("nodemailer");
  const transport = nodemailer.createTransport(env.smtpUrl);
  const info = await transport.sendMail({
    from: env.emailFrom,
    to: msg.to,
    subject: msg.subject,
    html: msg.html,
    text: msg.text,
    replyTo: env.emailReplyTo,
  });
  return { ok: true, id: info.messageId };
}

/**
 * Sends a transactional email through the configured provider and records the outcome.
 * Never throws: email failures must not roll back order state. Failures are visible in EmailLog.
 */
export async function sendEmail(msg: OutgoingEmail): Promise<boolean> {
  const provider = env.emailProvider;
  let result: SendResult;
  try {
    if (provider === "memory") {
      memoryOutbox.push(msg);
      result = { ok: true, id: `mem-${memoryOutbox.length}` };
    } else if (provider === "resend") result = await sendResend(msg);
    else if (provider === "postmark") result = await sendPostmark(msg);
    else if (provider === "smtp") result = await sendSmtp(msg);
    else {
      console.info(`[email:log] to=${msg.to} subject="${msg.subject}"\n${msg.text}`);
      result = { ok: true, id: "logged" };
    }
  } catch (e) {
    result = { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  await prisma.emailLog
    .create({
      data: {
        enrollmentId: msg.enrollmentId ?? null,
        template: msg.template,
        toHash: lookupHash(msg.to),
        subject: msg.subject,
        provider,
        status: result.ok ? (provider === "log" ? "SKIPPED" : "SENT") : "FAILED",
        providerMessageId: result.ok ? (result.id ?? null) : null,
        error: result.ok ? null : result.error.slice(0, 500),
      },
    })
    .catch((e) => console.error("Failed to write EmailLog", e));

  if (!result.ok) console.error(`[email] ${msg.template} failed: ${result.error}`);
  return result.ok;
}
