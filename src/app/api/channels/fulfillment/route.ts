import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/channels/fulfillment — L3 (D022)
 * Canal de demanda (marketplace/loja) → job WAITING_MAKER.
 * Auth: maker | admin | client (mesmo writer de orders).
 * body: { channel?, externalId?, catalogId?, zipCode?, material? }
 */
export async function POST(req: NextRequest) {
  try {
    const { requireOrderWriter } = await import("@/lib/orderAuth");
    const writer = requireOrderWriter(req);
    if (!writer.ok) return writer.response;

    const body = await req.json();
    const channel = String(body.channel || "marketplace").toLowerCase();
    const externalId = String(body.externalId || `ext-${Date.now()}`);
    const catalogId = String(body.catalogId || "fm-cable-clip");
    const zipCode = String(body.zipCode || "01310-100");
    const material = String(body.material || "PLA");

    const { getCuratedModel } = await import("@/lib/curatedCatalog");
    const model = getCuratedModel(catalogId);
    if (!model) {
      return NextResponse.json({ success: false, error: "catalogId inválido." }, { status: 400 });
    }

    const { computeQuote } = await import("@/lib/quoteEngine");
    const quote = computeQuote({
      volumeMm3: model.volumeMm3,
      boundingBox: model.boundingBox,
      trianglesCount: model.trianglesCount,
      filename: model.filename,
      material: material || model.defaultMaterial,
      infillPercent: 20,
      layerHeight: "0.20",
      infillPattern: "grid",
      royaltyPrice: 0,
    });

    const { prisma } = await import("@/lib/db");
    let client =
      writer.role === "CLIENT"
        ? await prisma.user.findFirst({ where: { email: writer.email, role: "CLIENT" } })
        : await prisma.user.findFirst({ where: { role: "CLIENT" } });
    if (!client) {
      client = await prisma.user.create({
        data: {
          name: "Canal Demanda",
          email: "canal@fabmakers.com.br",
          passwordHash: "dummy-hash",
          role: "CLIENT",
        },
      });
    }

    const orderId = `ch-${channel}-${Date.now()}`;
    const price = quote.pricing.totalPrice;
    const order = await prisma.order.create({
      data: {
        id: orderId,
        status: "WAITING_MAKER",
        totalPrice: price,
        makerPrice: 1,
        royaltyPaid: quote.metrics.weightG,
        platformFee: price * 0.05,
        shippingZip: zipCode,
        shippingAddress: `${material}|channel:${channel}|ext:${externalId}`,
        clientId: client.id,
        filename: model.filename,
        catalogId: model.id,
        modelId: null,
      },
    });

    return NextResponse.json({
      success: true,
      channel,
      externalId,
      orderId: order.id,
      catalogId: model.id,
      totalPrice: price,
      message: "Demanda do canal entrou na fila WAITING_MAKER.",
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("channels/fulfillment:", msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
