import { PrismaClient } from '@prisma/client'
import { createClient } from '@libsql/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'

function buildPrismaClient(): PrismaClient {
  const url = process.env.TURSO_DATABASE_URL
  const authToken = process.env.TURSO_AUTH_TOKEN

  if (!url || url === 'undefined' || url.trim() === '') {
    throw new Error(
      `[FabMakers] TURSO_DATABASE_URL não está definida no ambiente. ` +
      `Verifique as variáveis de ambiente na Vercel.`
    )
  }

  const libsql = createClient({
    url,
    authToken: authToken && authToken !== 'undefined' ? authToken : undefined,
  })

  const adapter = new PrismaLibSql(libsql as any)
  return new PrismaClient({ adapter })
}

// Singleton seguro para Next.js (evita múltiplas instâncias em dev)
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma: PrismaClient =
  globalForPrisma.prisma ?? (globalForPrisma.prisma = buildPrismaClient())