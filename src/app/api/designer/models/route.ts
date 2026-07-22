import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET  /api/designer/models — lista pública de Model3D (L1)
 * POST /api/designer/models — publica modelo (requer designerToken)
 * body: { title, description, fileUrl?, royaltyPrice, catalogId? }
 */
export async function GET() {
  try {
    const { prisma } = await import("@/lib/db");
    const models = await prisma.model3D.findMany({
      include: { designer: { include: { user: true } } },
      orderBy: { title: "asc" },
    });
    return NextResponse.json({
      success: true,
      models: models.map((m) => ({
        id: m.id,
        title: m.title,
        description: m.description,
        fileUrl: m.fileUrl,
        royaltyPrice: m.royaltyPrice,
        gcodeStream: m.gcodeStream,
        designerName: m.designer.user.name,
        designerEmail: m.designer.user.email,
      })),
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { requireDesigner } = await import("@/lib/designerAuth");
    const auth = requireDesigner(req);
    if (!auth.ok) return auth.response;

    const { prisma } = await import("@/lib/db");
    const body = await req.json();
    const title = String(body.title || "").trim();
    const description = String(body.description || "").trim();
    const royaltyPrice = parseFloat(String(body.royaltyPrice ?? "0"));
    const catalogId = body.catalogId ? String(body.catalogId) : "fm-cable-clip";
    const { getCuratedModel } = await import("@/lib/curatedCatalog");
    const curated = getCuratedModel(catalogId);
    const fileUrl =
      String(body.fileUrl || "").trim() ||
      curated?.stlUrl ||
      "/catalog/presilha_cabos_fm.stl";

    if (!title) {
      return NextResponse.json({ success: false, error: "Informe o título." }, { status: 400 });
    }
    if (!Number.isFinite(royaltyPrice) || royaltyPrice < 0) {
      return NextResponse.json({ success: false, error: "royaltyPrice inválido." }, { status: 400 });
    }

    let user = await prisma.user.findFirst({
      where: { email: auth.email, role: "DESIGNER" },
      include: { designerProfile: true },
    });
    if (!user) {
      return NextResponse.json({ success: false, error: "Designer não encontrado." }, { status: 404 });
    }
    if (!user.designerProfile) {
      const profile = await prisma.designerProfile.create({
        data: { userId: user.id, paypalEmail: auth.email },
      });
      user = { ...user, designerProfile: profile };
    }

    const model = await prisma.model3D.create({
      data: {
        title,
        description:
          description ||
          `Licença comercial OK · ref ${catalogId} · ${curated?.licenseNote || "FabMakers L1"}`,
        fileUrl,
        royaltyPrice,
        gcodeStream: true,
        designerId: user.designerProfile!.id,
      },
    });

    return NextResponse.json({
      success: true,
      model: {
        id: model.id,
        title: model.title,
        royaltyPrice: model.royaltyPrice,
        fileUrl: model.fileUrl,
        catalogId,
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("designer/models POST:", msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
