import { PrismaClient } from '@prisma/client'
import { createClient } from '@libsql/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'

function buildPrismaClient(): PrismaClient {
  const tursoUrl = process.env.TURSO_DATABASE_URL
  const authToken = process.env.TURSO_AUTH_TOKEN

  if (!tursoUrl || tursoUrl === 'undefined' || tursoUrl.trim() === '') {
    throw new Error(
      `[FabMakers DB] TURSO_DATABASE_URL não está definida. Configure a variável de ambiente na Vercel.`
    )
  }

  // O Prisma v7 ainda lê DATABASE_URL internamente mesmo com adapter.
  // Forçamos um valor válido para sqlite antes de inicializar o client.
  // A conexão REAL vai pelo adapter libsql usando TURSO_DATABASE_URL.
  if (!process.env.DATABASE_URL || process.env.DATABASE_URL === 'undefined') {
    process.env.DATABASE_URL = 'file:./dev.db'
  }

  const libsql = createClient({
    url: tursoUrl,
    authToken: authToken && authToken !== 'undefined' ? authToken : undefined,
  })

  const adapter = new PrismaLibSql(libsql as any)
  return new PrismaClient({ adapter })
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma: PrismaClient =
  globalForPrisma.prisma ?? (globalForPrisma.prisma = buildPrismaClient())