import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

/**
 * Funil H5 — cadastro maker → homologado.
 * Contagens por makerStatus para invalidar/confirmar a aposta H5.
 * Requer adminToken (D009).
 */
export async function GET(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  try {
    const { prisma } = await import("@/lib/db");

    const profiles = await prisma.makerProfile.findMany({
      select: {
        makerStatus: true,
        isApproved: true,
        isBanned: true,
        user: { select: { name: true, email: true, createdAt: true } },
      },
      orderBy: { user: { createdAt: "desc" } },
    });

    const counts = {
      UNVERIFIED: 0,
      PENDING_APPROVAL: 0,
      SANDBOX: 0,
      HOMOLOGATED: 0,
      BANNED: 0,
      OTHER: 0,
    };

    for (const p of profiles) {
      const key = (p.makerStatus || "UNVERIFIED") as keyof typeof counts;
      if (key in counts && key !== "OTHER") counts[key] += 1;
      else counts.OTHER += 1;
    }

    const started = profiles.length;
    const homologatedUnique = profiles.filter(
      (p) => !p.isBanned && (p.makerStatus === "HOMOLOGATED" || p.isApproved)
    ).length;

    const conversionPct =
      started === 0 ? 0 : Math.round((homologatedUnique / started) * 1000) / 10;

    return NextResponse.json({
      success: true,
      hypothesis: "H5",
      funnel: {
        started,
        counts,
        homologated: homologatedUnique,
        conversionPct,
      },
      recent: profiles.slice(0, 12).map((p) => ({
        name: p.user?.name || "—",
        email: p.user?.email || "—",
        status: p.makerStatus,
        isApproved: p.isApproved,
        createdAt: p.user?.createdAt,
      })),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro";
    console.error("funnel/h5:", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
