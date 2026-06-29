import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

// GET /api/orders - Lista todos os pedidos
export async function GET() {
  try {
    const { prisma } = await import("@/lib/db");

    const dbOrders = await prisma.order.findMany({
      include: {
        client: true,
        maker: { include: { user: true } }
      },
      orderBy: { createdAt: "desc" }
    });

    const formattedOrders = dbOrders.map(o => ({
      id: o.id,
      filename: o.modelId || "peca_3d.stl",
      status: o.status,
      totalPrice: o.totalPrice,
      weightG: o.royaltyPaid || 15.0,
      timeFormatted: o.makerPrice ? `${Math.round(o.makerPrice)}h` : "1h 30min",
      progress: o.status === "COMPLETED" ? 100 : (o.status === "PRINTING" ? 45 : 0),
      material: o.shippingAddress || "PLA",
      zipCode: o.shippingZip,
      makerName: o.maker?.user.name || null,
      createdAt: o.createdAt.toLocaleDateString("pt-BR") + " " + o.createdAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    }));

    return NextResponse.json({ success: true, orders: formattedOrders });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Erro ao listar ordens:", msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// POST /api/orders - Cria um novo pedido no banco
export async function POST(req: NextRequest) {
  try {
    const { prisma } = await import("@/lib/db");

    const data = await req.json();
    const { id, filename, status, totalPrice, weightG, material, zipCode, makerName, timeFormatted } = data;

    let client = await prisma.user.findFirst({ where: { role: "CLIENT" } });
    if (!client) {
      client = await prisma.user.create({
        data: {
          name: "Cliente Geral",
          email: "cliente@fabmakers.com.br",
          passwordHash: "dummy-hash",
          role: "CLIENT"
        }
      });
    }

    let makerId: string | null = null;
    if (makerName) {
      const makerUser = await prisma.user.findFirst({
        where: { name: makerName },
        include: { makerProfile: true }
      });
      if (makerUser?.makerProfile) makerId = makerUser.makerProfile.id;
    }

    let order;
    if (id) {
      const existing = await prisma.order.findUnique({ where: { id } });
      if (existing) {
        order = await prisma.order.update({
          where: { id },
          data: { status, makerId, shippingAddress: material, shippingZip: zipCode, totalPrice: parseFloat(totalPrice || 0) }
        });
        return NextResponse.json({ success: true, orderId: order.id, action: "update" });
      }
    }

    order = await prisma.order.create({
      data: {
        id: id || undefined,
        status: status || "PENDING_QUOTATION",
        totalPrice: parseFloat(totalPrice || 0),
        makerPrice: parseFloat(timeFormatted?.replace(/\D/g, "") || "1"),
        royaltyPaid: parseFloat(weightG || 0),
        platformFee: parseFloat(totalPrice || 0) * 0.05,
        shippingZip: zipCode || "01001-000",
        shippingAddress: material || "PLA",
        clientId: client.id,
        makerId,
        modelId: filename || "peca.stl"
      }
    });

    return NextResponse.json({ success: true, orderId: order.id, action: "create" });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Erro ao criar/atualizar ordem:", msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
