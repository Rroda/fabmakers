import { PrismaClient } from '@prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import path from 'path'

function resolveLocalSqliteUrl(): string {
  const raw = process.env.DATABASE_URL?.trim();
  // Caminho canônico: prisma/dev.db (evita dual DB em ./dev.db vs ./prisma/dev.db)
  const canonical = path.join(process.cwd(), "prisma", "dev.db");
  const canonicalUrl = `file:${canonical.replace(/\\/g, "/")}`;

  if (raw?.startsWith("file:")) {
    const filePart = raw.slice("file:".length);
    // Relativos ambíguos (./dev.db) → sempre prisma/dev.db
    if (
      filePart === "./dev.db" ||
      filePart === "dev.db" ||
      filePart === "./prisma/dev.db" ||
      filePart.endsWith("/prisma/dev.db") ||
      filePart.endsWith("\\prisma\\dev.db")
    ) {
      return canonicalUrl;
    }
    if (path.isAbsolute(filePart.replace(/^\//, "")) || /^[A-Za-z]:/.test(filePart)) {
      return raw;
    }
    return canonicalUrl;
  }
  return canonicalUrl;
}

function buildPrismaClient(): PrismaClient {
  const url = process.env.TURSO_DATABASE_URL
  const authToken = process.env.TURSO_AUTH_TOKEN

  const useTurso =
    !!url &&
    url !== 'undefined' &&
    url.trim() !== '' &&
    (url.startsWith('libsql://') || url.startsWith('https://'))

  if (!useTurso) {
    const localUrl = resolveLocalSqliteUrl()
    console.info(`[FabMakers DB] Modo local SQLite: ${localUrl}`)
    const adapter = new PrismaLibSql({ url: localUrl })
    return new PrismaClient({ adapter })
  }

  const adapter = new PrismaLibSql({
    url,
    authToken: authToken && authToken !== 'undefined' ? authToken : undefined,
  })

  return new PrismaClient({ adapter })
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma: PrismaClient =
  globalForPrisma.prisma ?? (globalForPrisma.prisma = buildPrismaClient())
