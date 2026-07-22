import dns from "node:dns/promises";
import nodemailer from "nodemailer";

export type MailPayload = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export type MailResult =
  | { ok: true; mode: "smtp" | "console" }
  | { ok: false; error: string };

function smtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

/** Envio de e-mail — SMTP real se env set; senão log no console (MVP local). */
export async function sendMail(payload: MailPayload): Promise<MailResult> {
  if (!smtpConfigured()) {
    console.info(
      `[FabMakers mail:console]\nTo: ${payload.to}\nSubject: ${payload.subject}\n---\n${payload.text}\n---`
    );
    return { ok: true, mode: "console" };
  }

  try {
    const host = String(process.env.SMTP_HOST);
    const port = Number(process.env.SMTP_PORT || "587");
    const secure = process.env.SMTP_SECURE === "true" || port === 465;
    // Resolve IPv4 explícito — evita EBUSY/IPv6 em serverless (Zoho BR)
    const { address } = await dns.lookup(host, { family: 4 });

    const transporter = nodemailer.createTransport({
      host: address,
      port,
      secure,
      connectionTimeout: 20_000,
      greetingTimeout: 20_000,
      tls: { servername: host },
      auth: {
        user: process.env.SMTP_USER,
        // Zoho app passwords às vezes vêm com espaços na UI
        pass: String(process.env.SMTP_PASS).replace(/\s+/g, ""),
      },
    });

    const from =
      process.env.SMTP_FROM ||
      `FabMakers <${process.env.SMTP_USER}>`;

    await transporter.sendMail({
      from,
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
      html: payload.html || undefined,
    });

    return { ok: true, mode: "smtp" };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[FabMakers mail:smtp]", msg);
    return { ok: false, error: msg };
  }
}

export function mailTransportMode(): "smtp" | "console" {
  return smtpConfigured() ? "smtp" : "console";
}
