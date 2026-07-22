import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";

const TTL_MS = 24 * 60 * 60 * 1000;
const PREFIX = "tech";

function secret(): string {
  return (
    process.env.TECH_API_SECRET ||
    process.env.ADMIN_API_SECRET ||
    process.env.ADMIN_API_KEY ||
    "fabmakers-tech-dev-secret"
  );
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

export function issueTechToken(email: string): string {
  const exp = Date.now() + TTL_MS;
  const payload = `${PREFIX}|${email.toLowerCase().trim()}|${exp}`;
  const sig = sign(payload);
  return Buffer.from(`${payload}|${sig}`, "utf8").toString("base64url");
}

export function verifyTechToken(
  token: string
): { ok: true; email: string } | { ok: false; reason: string } {
  try {
    const raw = Buffer.from(token, "base64url").toString("utf8");
    const parts = raw.split("|");
    if (parts.length !== 4) return { ok: false, reason: "formato" };
    const [kind, email, expStr, sig] = parts;
    if (kind !== PREFIX) return { ok: false, reason: "tipo" };
    const payload = `${kind}|${email}|${expStr}`;
    const expected = sign(payload);
    const a = Buffer.from(sig, "utf8");
    const b = Buffer.from(expected, "utf8");
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return { ok: false, reason: "assinatura" };
    }
    const exp = Number(expStr);
    if (!Number.isFinite(exp) || Date.now() > exp) {
      return { ok: false, reason: "expirado" };
    }
    if (!email.includes("@")) return { ok: false, reason: "email" };
    return { ok: true, email };
  } catch {
    return { ok: false, reason: "parse" };
  }
}

export type TechAuthOk = { ok: true; email: string };
export type TechAuthDenied = { ok: false; response: NextResponse };

export function requireTech(req: NextRequest): TechAuthOk | TechAuthDenied {
  const header = req.headers.get("authorization") || "";
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!match) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: "Não autorizado. Envie Authorization: Bearer <techToken>." },
        { status: 401 }
      ),
    };
  }
  const result = verifyTechToken(match[1].trim());
  if (!result.ok) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: `Token tech inválido (${result.reason}).` },
        { status: 401 }
      ),
    };
  }
  return { ok: true, email: result.email };
}
