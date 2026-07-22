import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

// POST /api/auth/login - Autenticação baseada em perfis reais
export async function POST(req: NextRequest) {
  try {
    // Import dinâmico garante que db.ts só é inicializado em runtime,
    // com todas as variáveis de ambiente da Vercel já carregadas
    const { prisma } = await import("@/lib/db");
    
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
        const { issueAdminToken } = await import("@/lib/adminAuth");
        return NextResponse.json({
          success: true,
          user: {
            name: "Administrador Geral",
            email: "admin@fabmakers.com.br",
            role: "ADMIN"
          },
          adminToken: issueAdminToken(cleanEmail),
        });
      }
      return NextResponse.json(
        { success: false, error: "Credenciais de administrador incorretas." },
        { status: 401 }
      );
    }

    // 2. Fluxo do Maker
    if (role === "MAKER") {
      // Conta MVP canônica (D012) — garante maker homologado para demos
      if (cleanEmail === "roda@fabmakers.com.br" && password === "123") {
        const { MVP_DEMO_MACHINES, MVP_DEMO_FILAMENTS, MVP_DEMO_AVAILABILITY } = await import(
          "@/lib/mvpMakerDefaults"
        );
        const machinesJson = JSON.stringify(MVP_DEMO_MACHINES);
        const materialsJson = JSON.stringify(MVP_DEMO_FILAMENTS);
        const availabilityJson = JSON.stringify(MVP_DEMO_AVAILABILITY);

        let mvp = await prisma.user.findFirst({
          where: { email: cleanEmail, role: "MAKER" },
          include: { makerProfile: true },
        });
        if (!mvp) {
          mvp = await prisma.user.create({
            data: {
              name: "Roda Fab",
              email: cleanEmail,
              passwordHash: "123",
              role: "MAKER",
              emailVerified: true,
              makerProfile: {
                create: {
                  city: "01310-100",
                  state: "SP",
                  rating: 5,
                  isApproved: true,
                  isBanned: false,
                  makerStatus: "HOMOLOGATED",
                  contractAccepted: true,
                  kycStatus: "APPROVED",
                  machines: machinesJson,
                  materials: materialsJson,
                  availability: availabilityJson,
                },
              },
            },
            include: { makerProfile: true },
          });
        } else if (mvp.makerProfile) {
          const emptyFleet =
            !mvp.makerProfile.machines ||
            mvp.makerProfile.machines === "[]" ||
            !mvp.makerProfile.materials ||
            mvp.makerProfile.materials === "[]";
          const needsHomolog =
            !mvp.makerProfile.isApproved ||
            mvp.passwordHash !== "123" ||
            ["APPROVED", "UNVERIFIED", "PENDING_APPROVAL"].includes(mvp.makerProfile.makerStatus);

          if (emptyFleet || needsHomolog) {
            await prisma.user.update({
              where: { id: mvp.id },
              data: { passwordHash: "123" },
            });
            await prisma.makerProfile.update({
              where: { id: mvp.makerProfile.id },
              data: {
                isApproved: true,
                isBanned: false,
                makerStatus: "HOMOLOGATED",
                contractAccepted: true,
                kycStatus: "APPROVED",
                city: mvp.makerProfile.city || "01310-100",
                state: mvp.makerProfile.state || "SP",
                ...(emptyFleet
                  ? {
                      machines: machinesJson,
                      materials: materialsJson,
                      availability: availabilityJson,
                    }
                  : {}),
              },
            });
            mvp = await prisma.user.findFirst({
              where: { id: mvp.id },
              include: { makerProfile: true },
            });
          }
        }
        if (mvp?.makerProfile) {
          const { issueMakerToken } = await import("@/lib/makerAuth");
          return NextResponse.json({
            success: true,
            user: {
              name: mvp.name,
              email: mvp.email,
              role: "MAKER",
              makerStatus: mvp.makerProfile.makerStatus || "HOMOLOGATED",
              profile: {
                id: mvp.makerProfile.id,
                name: mvp.name,
                city: mvp.makerProfile.city,
                state: mvp.makerProfile.state,
                zipCode: mvp.makerProfile.city || "01310-100",
                rating: mvp.makerProfile.rating,
                penalties: mvp.makerProfile.penaltiesCount ?? 0,
                isApproved: mvp.makerProfile.isApproved,
                isBanned: mvp.makerProfile.isBanned,
                makerStatus: mvp.makerProfile.makerStatus,
                contractAccepted: mvp.makerProfile.contractAccepted,
                kycStatus: mvp.makerProfile.kycStatus || "APPROVED",
                machines: JSON.parse(mvp.makerProfile.machines || "[]"),
                filaments: JSON.parse(mvp.makerProfile.materials || "[]"),
                availability: {
                  days: [] as string[],
                  shifts: [] as string[],
                  months: [] as string[],
                  ...JSON.parse(mvp.makerProfile.availability || "{}"),
                },
                kycDocumentUrl: mvp.makerProfile.kycDocumentUrl,
                kycSelfieUrl: mvp.makerProfile.kycSelfieUrl,
                calibX: mvp.makerProfile.calibX,
                calibY: mvp.makerProfile.calibY,
                calibZ: mvp.makerProfile.calibZ,
                calibImageUrl: mvp.makerProfile.calibImageUrl,
              },
            },
            makerToken: issueMakerToken(cleanEmail),
          });
        }
      }

      const user = await prisma.user.findFirst({
        where: { email: cleanEmail, role: "MAKER" },
        include: { makerProfile: true }
      });

      if (!user) {
        return NextResponse.json(
          { success: false, error: "Cadastro de Maker não encontrado com este e-mail." },
          { status: 404 }
        );
      }

      if (user.passwordHash && user.passwordHash !== "dummy-hash" && user.passwordHash !== password) {
        return NextResponse.json(
          { success: false, error: "Senha incorreta para este cadastro de Maker." },
          { status: 401 }
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
            name: user.name,
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
        },
        makerToken: (await import("@/lib/makerAuth")).issueMakerToken(cleanEmail),
      });
    }

    // 3. Fluxo do Cliente
    if (role === "CLIENT") {
      let user = await prisma.user.findFirst({
        where: { email: cleanEmail, role: "CLIENT" }
      });

      if (!user) {
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
      } else if (user.passwordHash && user.passwordHash !== "dummy-hash" && user.passwordHash !== password) {
        return NextResponse.json(
          { success: false, error: "Senha incorreta para este cadastro de Cliente." },
          { status: 401 }
        );
      }

      return NextResponse.json({
        success: true,
        user: { name: user.name, email: user.email, role: "CLIENT" },
        clientToken: (await import("@/lib/clientAuth")).issueClientToken(cleanEmail),
      });
    }

    // 4. Fluxo do Designer
    if (role === "DESIGNER") {
      let user = await prisma.user.findFirst({
        where: { email: cleanEmail, role: "DESIGNER" }
      });

      if (!user) {
        const baseName = cleanEmail.split("@")[0];
        const formattedName = baseName.charAt(0).toUpperCase() + baseName.slice(1);
        user = await prisma.user.create({
          data: {
            name: formattedName,
            email: cleanEmail,
            passwordHash: "dummy-hash",
            role: "DESIGNER"
          }
        });
      }

      // Busca perfil de designer associado (pode ser mockado ou adicionado em tabela no DB, mas
      // para total robustez, retornamos os campos do designer)
      return NextResponse.json({
        success: true,
        user: { name: user.name, email: user.email, role: "DESIGNER" }
      });
    }

    // 5. Fluxo do Moderador
    if (role === "MODERATOR") {
      if (cleanEmail === "moderador@fabmakers.com.br" && password === "moderador123") {
        return NextResponse.json({
          success: true,
          user: {
            name: "Moderador da Rede",
            email: "moderador@fabmakers.com.br",
            role: "MODERATOR"
          }
        });
      }
      // Criação automática para testes locais rápidos
      let user = await prisma.user.findFirst({
        where: { email: cleanEmail, role: "MODERATOR" }
      });
      if (!user) {
        user = await prisma.user.create({
          data: {
            name: "Moderador Auxiliar",
            email: cleanEmail,
            passwordHash: "dummy-hash",
            role: "MODERATOR"
          }
        });
      }
      return NextResponse.json({
        success: true,
        user: { name: user.name, email: user.email, role: "MODERATOR" }
      });
    }

    return NextResponse.json(
      { success: false, error: "Perfil de login inválido." },
      { status: 400 }
    );

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Erro na autenticação:", msg);
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    );
  }
}
