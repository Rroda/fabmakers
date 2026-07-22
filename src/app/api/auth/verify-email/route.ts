import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const TTL_MS = 15 * 60 * 1000; // 15 min

function parseToken(raw: string | null | undefined): { code: string; exp: number } | null {
  if (!raw || !raw.includes(":")) return null;
  const [code, expStr] = raw.split(":");
  const exp = Number(expStr);
  if (!code || !Number.isFinite(exp)) return null;
  return { code, exp };
}

/**
 * POST /api/auth/verify-email
 * body: { action: "send" | "confirm", email, code? }
 * D013 — código de ativação; SMTP se env; console+devCode no MVP local.
 */
export async function POST(req: NextRequest) {
  try {
    const { prisma } = await import("@/lib/db");
    const { sendMail, mailTransportMode } = await import("@/lib/mail");
    const body = await req.json();
    const action = body.action as "send" | "confirm";
    const email = String(body.email || "")
      .toLowerCase()
      .trim();
    const codeIn = String(body.code || "").trim();

    if (!email || !email.includes("@")) {
      return NextResponse.json({ success: false, error: "E-mail inválido." }, { status: 400 });
    }
    if (action !== "send" && action !== "confirm") {
      return NextResponse.json({ success: false, error: "action inválida." }, { status: 400 });
    }

    let user = await prisma.user.findFirst({ where: { email } });
    if (!user) {
      // Wizard pode confirmar antes do POST /api/maker — cria stub CLIENT/MAKER-pending
      user = await prisma.user.create({
        data: {
          name: email.split("@")[0],
          email,
          passwordHash: "dummy-hash",
          role: "MAKER",
          emailVerified: false,
        },
      });
    }

    if (action === "send") {
      const code = String(Math.floor(100000 + Math.random() * 900000));
      const exp = Date.now() + TTL_MS;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          verificationToken: `${code}:${exp}`,
          emailVerified: false,
        },
      });

      const mail = await sendMail({
        to: email,
        subject: "FabMakers — código de verificação",
        text: `Seu código FabMakers é ${code}. Válido por 15 minutos.\n\nSe você não solicitou, ignore este e-mail.`,
        html: `<p>Seu código FabMakers é <strong style="letter-spacing:0.2em">${code}</strong>.</p><p>Válido por 15 minutos.</p>`,
      });

      if (!mail.ok) {
        return NextResponse.json(
          { success: false, error: `Falha ao enviar e-mail: ${mail.error}` },
          { status: 502 }
        );
      }

      return NextResponse.json({
        success: true,
        mode: mail.mode,
        // Só em console: facilita smoke local sem caixa de entrada
        ...(mail.mode === "console" ? { devCode: code } : {}),
        message:
          mail.mode === "smtp"
            ? "Código enviado para o e-mail."
            : "SMTP não configurado — código gerado (modo console).",
      });
    }

    // confirm
    if (!codeIn || codeIn.length < 4) {
      return NextResponse.json({ success: false, error: "Informe o código." }, { status: 400 });
    }

    const parsed = parseToken(user.verificationToken);
    if (!parsed) {
      return NextResponse.json(
        { success: false, error: "Nenhum código pendente. Solicite um novo." },
        { status: 400 }
      );
    }
    if (Date.now() > parsed.exp) {
      return NextResponse.json(
        { success: false, error: "Código expirado. Solicite um novo." },
        { status: 400 }
      );
    }
    if (parsed.code !== codeIn) {
      return NextResponse.json({ success: false, error: "Código incorreto." }, { status: 401 });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true, verificationToken: null },
    });

    return NextResponse.json({
      success: true,
      emailVerified: true,
      mode: mailTransportMode(),
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("verify-email:", msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
