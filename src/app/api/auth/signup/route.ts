import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

// POST /api/auth/signup - Cadastro real de Clientes e Makers
export async function POST(req: NextRequest) {
  try {
    const { prisma } = await import("@/lib/db");

    const data = await req.json();
    const { name, email, password, role } = data;

    if (!name || !email || !password || !role) {
      return NextResponse.json(
        { success: false, error: "Nome, E-mail, Senha e Perfil são obrigatórios." },
        { status: 400 }
      );
    }

    const cleanEmail = email.toLowerCase().trim();

    const existingUser = await prisma.user.findFirst({
      where: { email: cleanEmail, role: role }
    });

    if (existingUser) {
      return NextResponse.json(
        { success: false, error: `Já existe um cadastro de ${role === "MAKER" ? "Maker" : "Cliente"} com este e-mail.` },
        { status: 409 }
      );
    }

    const user = await prisma.user.create({
      data: {
        name,
        email: cleanEmail,
        passwordHash: password,
        role
      }
    });

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

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Erro no cadastro:", msg);
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    );
  }
}
