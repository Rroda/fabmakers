import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// POST /api/auth/login - Autenticação baseada em perfis reais
export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const { email, password, role } = data;

    if (!email || !role) {
      return NextResponse.json(
        { success: false, error: "E-mail e Perfil são campos obrigatórios." },
        { status: 400 }
      );
    }

    const cleanEmail = email.toLowerCase().trim();

    // 1. Fluxo do Administrador
    if (role === "ADMIN") {
      if (cleanEmail === "admin@fabmakers.com.br" && password === "admin123") {
        return NextResponse.json({
          success: true,
          user: {
            name: "Administrador Geral",
            email: "admin@fabmakers.com.br",
            role: "ADMIN"
          }
        });
      }
      return NextResponse.json(
        { success: false, error: "Credenciais de administrador incorretas." },
        { status: 401 }
      );
    }

    // 2. Fluxo do Maker (Precisa existir na tabela User / MakerProfile)
    if (role === "MAKER") {
      const user = await prisma.user.findFirst({
        where: {
          email: cleanEmail,
          role: "MAKER"
        },
        include: {
          makerProfile: true
        }
      });

      if (!user) {
        return NextResponse.json(
          { success: false, error: "Cadastro de Maker não encontrado com este e-mail." },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        user: {
          name: user.name,
          email: user.email,
          role: "MAKER",
          makerStatus: user.makerProfile?.makerStatus || "UNVERIFIED",
          profile: user.makerProfile ? {
            id: user.makerProfile.id,
            city: user.makerProfile.city,
            state: user.makerProfile.state,
            rating: user.makerProfile.rating,
            isApproved: user.makerProfile.isApproved,
            isBanned: user.makerProfile.isBanned,
            makerStatus: user.makerProfile.makerStatus,
            machines: JSON.parse(user.makerProfile.machines || "[]"),
            filaments: JSON.parse(user.makerProfile.materials || "[]"),
            availability: JSON.parse(user.makerProfile.availability || '{"days":[], "shifts":[]}'),
            kycDocumentUrl: user.makerProfile.kycDocumentUrl,
            kycSelfieUrl: user.makerProfile.kycSelfieUrl,
            calibX: user.makerProfile.calibX,
            calibY: user.makerProfile.calibY,
            calibZ: user.makerProfile.calibZ,
            calibImageUrl: user.makerProfile.calibImageUrl
          } : null
        }
      });
    }

    // 3. Fluxo do Cliente (Cria a conta automática na primeira cotação se não existir)
    if (role === "CLIENT") {
      let user = await prisma.user.findFirst({
        where: {
          email: cleanEmail,
          role: "CLIENT"
        }
      });

      if (!user) {
        // Criação automática rápida para demonstração sem atritos
        const baseName = cleanEmail.split("@")[0];
        const formattedName = baseName.charAt(0).toUpperCase() + baseName.slice(1);
        
        user = await prisma.user.create({
          data: {
            name: formattedName,
            email: cleanEmail,
            passwordHash: "dummy-hash",
            role: "CLIENT"
          }
        });
      }

      return NextResponse.json({
        success: true,
        user: {
          name: user.name,
          email: user.email,
          role: "CLIENT"
        }
      });
    }

    return NextResponse.json(
      { success: false, error: "Perfil de login inválido." },
      { status: 400 }
    );

  } catch (error: any) {
    console.error("Erro na autenticação de login:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
