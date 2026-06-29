import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

// GET /api/maker - Lista todos os makers cadastrados no banco
export async function GET() {
  try {
    const { prisma } = await import("@/lib/db");

    const profiles = await prisma.makerProfile.findMany({ include: { user: true } });

    const formattedMakers = profiles.map(p => ({
      name: p.user.name,
      zipCode: p.user.verificationToken || p.city,
      rating: p.rating,
      penalties: p.penaltiesCount,
      isBanned: p.isBanned,
      isApproved: p.isApproved,
      makerStatus: p.makerStatus,
      machines: JSON.parse(p.machines || "[]"),
      filaments: JSON.parse(p.materials || "[]"),
      availability: JSON.parse(p.availability || '{"days":[], "shifts":[]}'),
      calibX: p.calibX,
      calibY: p.calibY,
      calibZ: p.calibZ,
      calibImageUrl: p.calibImageUrl,
      kycDocumentName: p.kycDocumentUrl,
      kycSelfieName: p.kycSelfieUrl
    }));

    return NextResponse.json({ success: true, makers: formattedMakers });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Erro ao listar makers:", msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// POST /api/maker - Salva ou atualiza um cadastro de Maker
export async function POST(req: NextRequest) {
  try {
    const { prisma } = await import("@/lib/db");

    const data = await req.json();
    const {
      name, email, zipCode, machines, filaments, availability,
      makerStatus, calibX, calibY, calibZ, calibImageUrl,
      kycDocumentName, kycSelfieName, contractAccepted
    } = data;

    if (!email || !name) {
      return NextResponse.json({ success: false, error: "Nome e e-mail são obrigatórios." }, { status: 400 });
    }

    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await prisma.user.create({
        data: { name, email, passwordHash: "dummy-hash", role: "MAKER", verificationToken: zipCode }
      });
    } else {
      user = await prisma.user.update({ where: { email }, data: { name, verificationToken: zipCode } });
    }

    let profile = await prisma.makerProfile.findUnique({ where: { userId: user.id } });

    const profileData = {
      city: zipCode || "",
      state: "SP",
      machines: JSON.stringify(machines || []),
      materials: JSON.stringify(filaments || []),
      availability: JSON.stringify(availability || { days: [], shifts: [] }),
      makerStatus: makerStatus || "UNVERIFIED",
      contractAccepted: contractAccepted || false,
      calibX: calibX ? parseFloat(calibX) : null,
      calibY: calibY ? parseFloat(calibY) : null,
      calibZ: calibZ ? parseFloat(calibZ) : null,
      calibImageUrl: calibImageUrl || null,
      kycDocumentUrl: kycDocumentName || null,
      kycSelfieUrl: kycSelfieName || null,
      isApproved: makerStatus === "SANDBOX" || makerStatus === "HOMOLOGATED"
    };

    if (!profile) {
      profile = await prisma.makerProfile.create({ data: { userId: user.id, ...profileData } });
    } else {
      profile = await prisma.makerProfile.update({ where: { userId: user.id }, data: profileData });
    }

    return NextResponse.json({ success: true, profileId: profile.id, status: profile.makerStatus });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Erro ao salvar maker:", msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
