import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/orders - Lista todos os pedidos
export async function GET() {
  try {
    const dbOrders = await prisma.order.findMany({
      include: {
        client: true,
        maker: {
          include: {
            user: true
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    // Mapeia para o formato que o frontend espera (SimulatedOrder)
    const formattedOrders = dbOrders.map(o => ({
      id: o.id,
      filename: o.modelId || "peca_3d.stl",
      status: o.status,
      totalPrice: o.totalPrice,
      weightG: o.royaltyPaid || 15.0, // peso real guardado em royaltyPaid
      timeFormatted: o.makerPrice ? `${Math.round(o.makerPrice)}h` : "1h 30min",
      progress: o.status === "COMPLETED" ? 100 : (o.status === "PRINTING" ? 45 : 0),
      material: o.shippingAddress || "PLA", // material guardado em shippingAddress
      zipCode: o.shippingZip,
      makerName: o.maker?.user.name || null,
      createdAt: o.createdAt.toLocaleDateString("pt-BR") + " " + o.createdAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    }));

    return NextResponse.json({ success: true, orders: formattedOrders });
  } catch (error: any) {
    console.error("Erro ao listar ordens:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST /api/orders - Cria um novo pedido no banco
export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const { 
      id, filename, status, totalPrice, weightG, material, zipCode, makerName, timeFormatted 
    } = data;

    // Busca um usuário cliente dummy ou cria um
    let client = await prisma.user.findFirst({
      where: { role: "CLIENT" }
    });

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

    // Busca o maker associado (se houver)
    let makerId: string | null = null;
    if (makerName) {
      const makerUser = await prisma.user.findFirst({
        where: { name: makerName },
        include: { makerProfile: true }
      });
      if (makerUser?.makerProfile) {
        makerId = makerUser.makerProfile.id;
      }
    }

    // Verifica se a ordem já existe para atualizar ou criar
    let order;
    if (id) {
      const existing = await prisma.order.findUnique({ where: { id } });
      if (existing) {
        order = await prisma.order.update({
          where: { id },
          data: {
            status: status,
            makerId: makerId,
            shippingAddress: material,
            shippingZip: zipCode,
            totalPrice: parseFloat(totalPrice || 0)
          }
        });
        return NextResponse.json({ success: true, orderId: order.id, action: "update" });
      }
    }

    // Se não existia, cria novo
    order = await prisma.order.create({
      data: {
        id: id || undefined,
        status: status || "PENDING_QUOTATION",
        totalPrice: parseFloat(totalPrice || 0),
        makerPrice: parseFloat(timeFormatted?.replace(/\D/g, "") || "1"), // tempo estimado
        royaltyPaid: parseFloat(weightG || 0), // peso
        platformFee: parseFloat(totalPrice || 0) * 0.20,
        shippingZip: zipCode || "01001-000",
        shippingAddress: material || "PLA", // material
        clientId: client.id,
        makerId: makerId,
        modelId: filename || "peca.stl"
      }
    });

    return NextResponse.json({ success: true, orderId: order.id, action: "create" });
  } catch (error: any) {
    console.error("Erro ao criar/atualizar ordem:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
