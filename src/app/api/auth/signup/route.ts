import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// POST /api/auth/signup - Cadastro real de Clientes e Makers
export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const { name, email, password, role } = data;

    if (!name || !email || !password || !role) {
      return NextResponse.json(
        { success: false, error: "Nome, E-mail, Senha e Perfil são obrigatórios." },
        { status: 400 }
      );
    }

    const cleanEmail = email.toLowerCase().trim();

    // Verifica se já existe um usuário com o mesmo e-mail e perfil
    const existingUser = await prisma.user.findFirst({
      where: {
        email: cleanEmail,
        role: role
      }
    });

    if (existingUser) {
      return NextResponse.json(
        { success: false, error: `Já existe um cadastro de ${role === "MAKER" ? "Maker" : "Cliente"} com este e-mail.` },
        { status: 409 }
      );
    }

    // Cria o usuário
    const user = await prisma.user.create({
      data: {
        name,
        email: cleanEmail,
        passwordHash: password, // Texto simples por simplicidade no protótipo local
        role
      }
    });

    // Se for MAKER, inicializa também o MakerProfile vazio
    let makerProfileData = null;
    if (role === "MAKER") {
      const profile = await prisma.makerProfile.create({
        data: {
          userId: user.id,
          city: "",
          state: "SP",
          machines: "[]",
          materials: "[]",
          availability: '{"days":[], "shifts":[]}',
          makerStatus: "UNVERIFIED"
        }
      });
      
      makerProfileData = {
        id: profile.id,
        city: profile.city,
        state: profile.state,
        rating: profile.rating,
        isApproved: profile.isApproved,
        isBanned: profile.isBanned,
        makerStatus: profile.makerStatus,
        machines: [],
        filaments: [],
        availability: { days: [], shifts: [] }
      };
    }

    return NextResponse.json({
      success: true,
      user: {
        name: user.name,
        email: user.email,
        role: user.role,
        makerStatus: makerProfileData ? "UNVERIFIED" : undefined,
        profile: makerProfileData
      }
    });

  } catch (error: any) {
    console.error("Erro no cadastro de usuário:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
