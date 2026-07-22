import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken } from "@/lib/adminAuth";
import { verifyMakerToken } from "@/lib/makerAuth";
import { verifyClientToken } from "@/lib/clientAuth";

export type OrderWriter =
  | { ok: true; role: "MAKER" | "ADMIN" | "CLIENT"; email: string }
  | { ok: false; response: NextResponse };

/**
 * D019 — POST /api/orders exige Bearer maker | admin | client.
 */
export function requireOrderWriter(req: NextRequest): OrderWriter {
  const header = req.headers.get("authorization") || "";
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!match) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          success: false,
          error: "Não autorizado. Envie Authorization: Bearer <makerToken|adminToken|clientToken>.",
        },
        { status: 401 }
      ),
    };
  }
  const token = match[1].trim();

  const maker = verifyMakerToken(token);
  if (maker.ok) return { ok: true, role: "MAKER", email: maker.email };

  const admin = verifyAdminToken(token);
  if (admin.ok) return { ok: true, role: "ADMIN", email: admin.email };

  const client = verifyClientToken(token);
  if (client.ok) return { ok: true, role: "CLIENT", email: client.email };

  return {
    ok: false,
    response: NextResponse.json(
      { success: false, error: "Token inválido para criar pedido." },
      { status: 401 }
    ),
  };
}
