import { PrismaClient } from '@prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'

function buildPrismaClient(): PrismaClient {
  const url = process.env.TURSO_DATABASE_URL
  const authToken = process.env.TURSO_AUTH_TOKEN

  if (!url || url === 'undefined' || url.trim() === '') {
    throw new Error(
      `[FabMakers DB] TURSO_DATABASE_URL não está definida. Configure a variável de ambiente na Vercel.`
    )
  }

  // PrismaLibSql recebe a CONFIG { url, authToken }, não um client já criado!
  // O adapter cria o cliente @libsql/client internamente.
  const adapter = new PrismaLibSql({
    url,
    authToken: authToken && authToken !== 'undefined' ? authToken : undefined,
  })

  return new PrismaClient({ adapter })
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma: PrismaClient =
  globalForPrisma.prisma ?? (globalForPrisma.prisma = buildPrismaClient())