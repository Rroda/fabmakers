import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const QUEUE_LIKE = new Set(["WAITING_MAKER", "PENDING_QUOTATION", "PAID"]);

function normalizeStatus(status: string): string {
  if (QUEUE_LIKE.has(status)) return "WAITING_MAKER";
  return status;
}

/** "1h 40min" → 1.666… horas (não concatenar dígitos → 140) */
function parseTimeToHours(timeFormatted?: string): number {
  if (!timeFormatted) return 1;
  const hMatch = timeFormatted.match(/(\d+)\s*h/i);
  const mMatch = timeFormatted.match(/(\d+)\s*m/i);
  const hours = hMatch ? parseInt(hMatch[1], 10) : 0;
  const mins = mMatch ? parseInt(mMatch[1], 10) : 0;
  if (hours || mins) return hours + mins / 60;
  const n = parseFloat(String(timeFormatted).replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function formatHours(h: number): string {
  if (!Number.isFinite(h) || h <= 0) return "1h";
  const whole = Math.floor(h);
  const mins = Math.round((h - whole) * 60);
  if (mins <= 0) return `${whole}h`;
  if (whole <= 0) return `${mins}min`;
  return `${whole}h ${mins}min`;
}

function progressFor(status: string): number {
  switch (status) {
    case "WAITING_MAKER":
      return 0;
    case "PRINTING":
      return 45;
    case "SHIPPED":
      return 90;
    case "COMPLETED":
      return 100;
    default:
      return 0;
  }
}

// GET /api/orders — lista pedidos (D015 queue/mine = maker; D020 toda listagem exige token)
// D019: POST exige maker|admin|client token.
export async function GET(req: NextRequest) {
  try {
    const { requireOrderWriter } = await import("@/lib/orderAuth");
    const access = requireOrderWriter(req);
    if (!access.ok) return access.response;

    const { prisma } = await import("@/lib/db");
    const filter = req.nextUrl.searchParams.get("filter"); // queue | mine | all
    const makerNameParam = req.nextUrl.searchParams.get("makerName");

    let makerDisplayName: string | null = null;
    if (filter === "queue" || filter === "mine") {
      if (access.role !== "MAKER") {
        return NextResponse.json(
          { success: false, error: "Fila/mine só para maker autenticado." },
          { status: 403 }
        );
      }
      const makerUser = await prisma.user.findFirst({
        where: { email: access.email, role: "MAKER" },
        include: { makerProfile: true },
      });
      if (!makerUser?.makerProfile) {
        return NextResponse.json(
          { success: false, error: "Maker do token não encontrado." },
          { status: 404 }
        );
      }
      makerDisplayName = makerUser.name;
    }

    const dbOrders = await prisma.order.findMany({
      include: {
        client: true,
        maker: { include: { user: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    let formattedOrders = dbOrders.map((o) => {
      const status = normalizeStatus(o.status);
      return {
        id: o.id,
        filename: o.filename || o.modelId || "peca_3d.stl",
        status,
        totalPrice: o.totalPrice,
        weightG: o.royaltyPaid || 15.0,
        timeFormatted: formatHours(o.makerPrice || 1),
        progress: progressFor(status),
        material: o.shippingAddress || "PLA",
        zipCode: o.shippingZip,
        makerName: o.maker?.user.name || null,
        clientEmail: o.client?.email || null,
        makerPayout: Math.max(0, o.totalPrice - o.platformFee),
        platformFee: o.platformFee,
        catalogId: o.catalogId || null,
        createdAt:
          o.createdAt.toLocaleDateString("pt-BR") +
          " " +
          o.createdAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      };
    });

    if (filter === "queue") {
      formattedOrders = formattedOrders.filter(
        (o) => o.status === "WAITING_MAKER" && !o.makerName
      );
    } else if (filter === "mine") {
      const name = makerDisplayName || makerNameParam;
      formattedOrders = formattedOrders.filter((o) => o.makerName === name);
    } else if (access.role === "CLIENT") {
      formattedOrders = formattedOrders.filter((o) => o.clientEmail === access.email);
    }

    return NextResponse.json({ success: true, orders: formattedOrders });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Erro ao listar ordens:", msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// POST /api/orders — cria pedido (seed) na fila WAITING_MAKER (D019: requer token)
export async function POST(req: NextRequest) {
  try {
    const { requireOrderWriter } = await import("@/lib/orderAuth");
    const writer = requireOrderWriter(req);
    if (!writer.ok) return writer.response;

    const { prisma } = await import("@/lib/db");

    const data = await req.json();
    const {
      id,
      filename,
      status,
      totalPrice,
      weightG,
      material,
      zipCode,
      makerName,
      timeFormatted,
      catalogId,
    } = data;

    let client =
      writer.role === "CLIENT"
        ? await prisma.user.findFirst({ where: { email: writer.email, role: "CLIENT" } })
        : await prisma.user.findFirst({ where: { role: "CLIENT" } });
    if (!client) {
      client = await prisma.user.create({
        data: {
          name: writer.role === "CLIENT" ? writer.email.split("@")[0] : "Cliente Geral",
          email:
            writer.role === "CLIENT" ? writer.email : "cliente@fabmakers.com.br",
          passwordHash: "dummy-hash",
          role: "CLIENT",
        },
      });
    }

    let makerId: string | null = null;
    if (makerName) {
      const makerUser = await prisma.user.findFirst({
        where: { name: makerName },
        include: { makerProfile: true },
      });
      if (makerUser?.makerProfile) makerId = makerUser.makerProfile.id;
    }

    const queueStatus = status === "WAITING_MAKER" || !status ? "WAITING_MAKER" : status;
    const price = parseFloat(String(totalPrice || 0));
    const fee = price * 0.05;

    if (id) {
      const existing = await prisma.order.findUnique({ where: { id } });
      if (existing) {
        const order = await prisma.order.update({
          where: { id },
          data: {
            status: queueStatus,
            makerId,
            shippingAddress: material,
            shippingZip: zipCode,
            totalPrice: price,
            platformFee: fee,
            royaltyPaid: parseFloat(String(weightG || 0)),
            filename: filename || existing.filename,
            catalogId: catalogId || existing.catalogId || null,
          },
        });
        return NextResponse.json({ success: true, orderId: order.id, action: "update" });
      }
    }

    const order = await prisma.order.create({
      data: {
        id: id || undefined,
        status: queueStatus,
        totalPrice: price,
        makerPrice: parseTimeToHours(timeFormatted),
        royaltyPaid: parseFloat(String(weightG || 0)),
        platformFee: fee,
        shippingZip: zipCode || "01001-000",
        shippingAddress: material || "PLA",
        clientId: client.id,
        makerId,
        filename: filename || "peca.stl",
        modelId: null,
        catalogId: catalogId || null,
      },
    });

    return NextResponse.json({ success: true, orderId: order.id, action: "create" });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Erro ao criar/atualizar ordem:", msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

/**
 * PATCH /api/orders — motor Core Supply-first (D011: requer makerToken)
 * body: { action: "claim" | "advance" | "release", orderId }
 * claim:   WAITING_MAKER → PRINTING (maker = token)
 * advance: PRINTING → SHIPPED → COMPLETED (só o maker dono)
 * release: PRINTING → WAITING_MAKER (só o maker dono)
 */
export async function PATCH(req: NextRequest) {
  try {
    const { requireMaker } = await import("@/lib/makerAuth");
    const auth = requireMaker(req);
    if (!auth.ok) return auth.response;

    const { prisma } = await import("@/lib/db");
    const body = await req.json();
    const { action, orderId } = body as {
      action: "claim" | "advance" | "release";
      orderId: string;
    };

    if (!action || !orderId) {
      return NextResponse.json(
        { success: false, error: "action e orderId são obrigatórios." },
        { status: 400 }
      );
    }

    const makerUser = await prisma.user.findFirst({
      where: { email: auth.email, role: "MAKER" },
      include: { makerProfile: true },
    });
    if (!makerUser?.makerProfile) {
      return NextResponse.json(
        { success: false, error: "Maker do token não encontrado." },
        { status: 404 }
      );
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { maker: { include: { user: true } } },
    });

    if (!order) {
      return NextResponse.json({ success: false, error: "Pedido não encontrado." }, { status: 404 });
    }

    const current = normalizeStatus(order.status);
    const makerProfileId = makerUser.makerProfile.id;
    const makerDisplayName = makerUser.name;

    if (action === "claim") {
      if (current !== "WAITING_MAKER" || order.makerId) {
        return NextResponse.json(
          { success: false, error: "Pedido não está disponível na fila." },
          { status: 409 }
        );
      }
      if (!makerUser.makerProfile.isApproved || makerUser.makerProfile.isBanned) {
        return NextResponse.json(
          { success: false, error: "Maker não homologado ou banido." },
          { status: 403 }
        );
      }

      const updated = await prisma.order.update({
        where: { id: orderId },
        data: { status: "PRINTING", makerId: makerProfileId },
        include: { maker: { include: { user: true } } },
      });

      return NextResponse.json({
        success: true,
        order: {
          id: updated.id,
          status: "PRINTING",
          progress: progressFor("PRINTING"),
          makerName: updated.maker?.user.name || makerDisplayName,
        },
      });
    }

    if (action === "advance" || action === "release") {
      if (order.makerId !== makerProfileId) {
        return NextResponse.json(
          { success: false, error: "Só o maker alocado pode alterar este job." },
          { status: 403 }
        );
      }
    }

    if (action === "advance") {
      let next: string | null = null;
      if (current === "PRINTING") next = "SHIPPED";
      else if (current === "SHIPPED") next = "COMPLETED";
      else {
        return NextResponse.json(
          { success: false, error: `Não é possível avançar a partir de ${current}.` },
          { status: 409 }
        );
      }

      const updated = await prisma.order.update({
        where: { id: orderId },
        data: { status: next },
        include: { maker: { include: { user: true } } },
      });

      return NextResponse.json({
        success: true,
        order: {
          id: updated.id,
          status: next,
          progress: progressFor(next),
          makerName: updated.maker?.user.name || null,
          payoutReleased: next === "COMPLETED",
          makerPayout: Math.max(0, updated.totalPrice - updated.platformFee),
        },
      });
    }

    if (action === "release") {
      if (current !== "PRINTING") {
        return NextResponse.json(
          { success: false, error: "Só é possível liberar jobs em PRINTING." },
          { status: 409 }
        );
      }
      const updated = await prisma.order.update({
        where: { id: orderId },
        data: { status: "WAITING_MAKER", makerId: null },
      });
      return NextResponse.json({
        success: true,
        order: { id: updated.id, status: "WAITING_MAKER", progress: 0, makerName: null },
      });
    }

    return NextResponse.json({ success: false, error: "action inválida." }, { status: 400 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Erro no motor de pedidos:", msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
