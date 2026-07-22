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
    const port = Number(process.env.SMTP_PORT || "587");
    const secure = process.env.SMTP_SECURE === "true" || port === 465;
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
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
