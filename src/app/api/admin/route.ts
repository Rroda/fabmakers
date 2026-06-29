import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/admin - Retorna a fila de homologações pendentes baseadas em MakerProfiles reais
export async function GET() {
  try {
    const pendingMakers = await prisma.makerProfile.findMany({
      where: {
        makerStatus: "PENDING_APPROVAL"
      },
      include: {
        user: true
      }
    });

    const formattedRequests = pendingMakers.map(p => ({
      id: p.id,
      name: p.user.name,
      zipCode: p.city,
      machineModel: JSON.parse(p.machines || "[]")[0]?.model || "Impressora 3D",
      benchmarkResult: "PENDING" as const,
      benchmarkImageUrl: p.calibImageUrl || "cubo_teste.jpg",
      documentUrl: p.kycDocumentUrl || "documento.jpg",
      selfieUrl: p.kycSelfieUrl || "selfie.jpg",
      calibX: p.calibX || 20.0,
      calibY: p.calibY || 20.0,
      calibZ: p.calibZ || 20.0,
      createdAt: p.user.updatedAt.toLocaleDateString("pt-BR")
    }));

    return NextResponse.json({ success: true, homologations: formattedRequests });
  } catch (error: any) {
    console.error("Erro ao listar homologações admin:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST /api/admin - Executa ação de aprovação, rejeição ou banimento
export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const { action, name } = data;

    if (!action || !name) {
      return NextResponse.json({ success: false, error: "Ação e nome do maker são obrigatórios." }, { status: 400 });
    }

    // Busca o usuário pelo nome
    const user = await prisma.user.findFirst({
      where: { name }
    });

    if (!user) {
      return NextResponse.json({ success: false, error: "Usuário não encontrado." }, { status: 404 });
    }

    if (action === "APPROVE") {
      await prisma.makerProfile.update({
        where: { userId: user.id },
        data: {
          isApproved: true,
          makerStatus: "SANDBOX"
        }
      });
    } else if (action === "REJECT") {
      await prisma.makerProfile.update({
        where: { userId: user.id },
        data: {
          isApproved: false,
          makerStatus: "UNVERIFIED"
        }
      });
    } else if (action === "BAN") {
      await prisma.makerProfile.update({
        where: { userId: user.id },
        data: {
          isBanned: true,
          makerStatus: "BANNED",
          rating: 3.0,
          penaltiesCount: 3
        }
      });
    } else if (action === "UNBAN") {
      await prisma.makerProfile.update({
        where: { userId: user.id },
        data: {
          isBanned: false,
          makerStatus: "SANDBOX",
          rating: 5.0,
          penaltiesCount: 0
        }
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Erro no processamento do admin:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
