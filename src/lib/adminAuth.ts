import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";

const TTL_MS = 24 * 60 * 60 * 1000; // 24h

function secret(): string {
  return process.env.ADMIN_API_SECRET || process.env.ADMIN_API_KEY || "fabmakers-admin-dev-secret";
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

/** Token opaco para APIs admin (MVP). Formato base64url(email|exp|sig). */
export function issueAdminToken(email: string): string {
  const exp = Date.now() + TTL_MS;
  const payload = `${email.toLowerCase().trim()}|${exp}`;
  const sig = sign(payload);
  return Buffer.from(`${payload}|${sig}`, "utf8").toString("base64url");
}

export function verifyAdminToken(token: string): { ok: true; email: string } | { ok: false; reason: string } {
  try {
    const raw = Buffer.from(token, "base64url").toString("utf8");
    const parts = raw.split("|");
    if (parts.length !== 3) return { ok: false, reason: "formato" };
    const [email, expStr, sig] = parts;
    const payload = `${email}|${expStr}`;
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
    if (email !== "admin@fabmakers.com.br") {
      return { ok: false, reason: "email" };
    }
    return { ok: true, email };
  } catch {
    return { ok: false, reason: "parse" };
  }
}

/** Retorna NextResponse 401 se inválido; null se OK. */
export function requireAdmin(req: NextRequest): NextResponse | null {
  const header = req.headers.get("authorization") || "";
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!match) {
    return NextResponse.json(
      { success: false, error: "Não autorizado. Envie Authorization: Bearer <adminToken>." },
      { status: 401 }
    );
  }
  const result = verifyAdminToken(match[1].trim());
  if (!result.ok) {
    return NextResponse.json(
      { success: false, error: `Token admin inválido (${result.reason}).` },
      { status: 401 }
    );
  }
  return null;
}
