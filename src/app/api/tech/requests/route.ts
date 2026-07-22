import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET  /api/tech/requests?filter=open|mine
 * POST /api/tech/requests — maker abre pedido de manutenção (L2/D023)
 * PATCH — claim | done (tech)
 */
export async function GET(req: NextRequest) {
  try {
    const { prisma } = await import("@/lib/db");
    const { ensureTechSchema } = await import("@/lib/ensureTechSchema");
    await ensureTechSchema(prisma);

    const filter = req.nextUrl.searchParams.get("filter") || "open";

    if (filter === "open") {
      const { requireTech } = await import("@/lib/techAuth");
      const auth = requireTech(req);
      if (!auth.ok) return auth.response;
      const rows = await prisma.techRequest.findMany({
        where: { status: "OPEN" },
        orderBy: { createdAt: "desc" },
        include: { makerUser: true },
      });
      return NextResponse.json({
        success: true,
        requests: rows.map((r) => ({
          id: r.id,
          status: r.status,
          title: r.title,
          description: r.description,
          machineBrand: r.machineBrand,
          machineModel: r.machineModel,
          zipCode: r.zipCode,
          makerName: r.makerUser.name,
          makerEmail: r.makerUser.email,
          createdAt: r.createdAt.toISOString(),
        })),
      });
    }

    if (filter === "mine") {
      const { requireMaker } = await import("@/lib/makerAuth");
      const auth = requireMaker(req);
      if (!auth.ok) return auth.response;
      const maker = await prisma.user.findFirst({
        where: { email: auth.email, role: "MAKER" },
      });
      if (!maker) {
        return NextResponse.json({ success: false, error: "Maker não encontrado." }, { status: 404 });
      }
      const rows = await prisma.techRequest.findMany({
        where: { makerUserId: maker.id },
        orderBy: { createdAt: "desc" },
        include: { technician: { include: { user: true } } },
      });
      return NextResponse.json({
        success: true,
        requests: rows.map((r) => ({
          id: r.id,
          status: r.status,
          title: r.title,
          description: r.description,
          machineBrand: r.machineBrand,
          machineModel: r.machineModel,
          zipCode: r.zipCode,
          technicianName: r.technician?.user.name || null,
          createdAt: r.createdAt.toISOString(),
        })),
      });
    }

    return NextResponse.json({ success: false, error: "filter inválido." }, { status: 400 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { requireMaker } = await import("@/lib/makerAuth");
    const auth = requireMaker(req);
    if (!auth.ok) return auth.response;

    const { prisma } = await import("@/lib/db");
    const { ensureTechSchema } = await import("@/lib/ensureTechSchema");
    await ensureTechSchema(prisma);

    const maker = await prisma.user.findFirst({
      where: { email: auth.email, role: "MAKER" },
      include: { makerProfile: true },
    });
    if (!maker) {
      return NextResponse.json({ success: false, error: "Maker não encontrado." }, { status: 404 });
    }

    const body = await req.json();
    const title = String(body.title || "").trim();
    const description = String(body.description || "").trim();
    const zipCode =
      String(body.zipCode || maker.makerProfile?.city || "01310-100").trim() || "01310-100";
    const machineBrand = body.machineBrand ? String(body.machineBrand) : null;
    const machineModel = body.machineModel ? String(body.machineModel) : null;

    if (!title || !description) {
      return NextResponse.json(
        { success: false, error: "Informe título e descrição do problema." },
        { status: 400 }
      );
    }

    const row = await prisma.techRequest.create({
      data: {
        status: "OPEN",
        title,
        description,
        zipCode,
        machineBrand,
        machineModel,
        makerUserId: maker.id,
      },
    });

    return NextResponse.json({
      success: true,
      request: {
        id: row.id,
        status: row.status,
        title: row.title,
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("tech/requests POST:", msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { requireTech } = await import("@/lib/techAuth");
    const auth = requireTech(req);
    if (!auth.ok) return auth.response;

    const { prisma } = await import("@/lib/db");
    const { ensureTechSchema } = await import("@/lib/ensureTechSchema");
    await ensureTechSchema(prisma);

    const techUser = await prisma.user.findFirst({
      where: { email: auth.email, role: "TECH" },
      include: { technicianProfile: true },
    });
    if (!techUser?.technicianProfile) {
      return NextResponse.json({ success: false, error: "Técnico não encontrado." }, { status: 404 });
    }

    const body = await req.json();
    const action = body.action as "claim" | "done";
    const requestId = String(body.requestId || "");
    if (!requestId || (action !== "claim" && action !== "done")) {
      return NextResponse.json({ success: false, error: "action/requestId inválidos." }, { status: 400 });
    }

    const row = await prisma.techRequest.findUnique({ where: { id: requestId } });
    if (!row) {
      return NextResponse.json({ success: false, error: "Pedido não encontrado." }, { status: 404 });
    }

    if (action === "claim") {
      if (row.status !== "OPEN") {
        return NextResponse.json({ success: false, error: "Pedido não está OPEN." }, { status: 409 });
      }
      const updated = await prisma.techRequest.update({
        where: { id: requestId },
        data: { status: "CLAIMED", technicianId: techUser.technicianProfile.id },
      });
      return NextResponse.json({ success: true, request: { id: updated.id, status: updated.status } });
    }

    // done
    if (row.status !== "CLAIMED" || row.technicianId !== techUser.technicianProfile.id) {
      return NextResponse.json(
        { success: false, error: "Só o técnico dono pode concluir." },
        { status: 403 }
      );
    }
    const updated = await prisma.techRequest.update({
      where: { id: requestId },
      data: { status: "DONE" },
    });
    return NextResponse.json({ success: true, request: { id: updated.id, status: updated.status } });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("tech/requests PATCH:", msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
