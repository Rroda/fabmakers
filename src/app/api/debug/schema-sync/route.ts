import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/debug/schema-sync
 * Alinha colunas Order no Turso (filename, catalogId) — one-shot pós-deploy.
 * Header: x-migrate-secret = ADMIN_API_SECRET | fabmakers-migrate-once
 */
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-migrate-secret") || "";
  const expected =
    process.env.ADMIN_API_SECRET ||
    process.env.ADMIN_API_KEY ||
    "fabmakers-migrate-once";
  if (secret !== expected && secret !== "fabmakers-migrate-once") {
    return NextResponse.json({ success: false, error: "Não autorizado." }, { status: 401 });
  }

  try {
    const { prisma } = await import("@/lib/db");
    const results: string[] = [];

    const stmts = [
      `ALTER TABLE "Order" ADD COLUMN filename TEXT`,
      `ALTER TABLE "Order" ADD COLUMN catalogId TEXT`,
    ];

    for (const sql of stmts) {
      try {
        await prisma.$executeRawUnsafe(sql);
        results.push(`ok: ${sql}`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        // coluna já existe
        if (/duplicate column|already exists/i.test(msg)) {
          results.push(`skip: ${sql}`);
        } else {
          results.push(`err: ${sql} → ${msg}`);
        }
      }
    }

    // Smoke: listar 1 pedido (ou vazio)
    const count = await prisma.order.count();
    return NextResponse.json({ success: true, results, orderCount: count });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
