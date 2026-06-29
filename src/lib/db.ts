import { PrismaClient } from '@prisma/client'
import { createClient } from '@libsql/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'

// Injeta fallback de variável de ambiente exigida pelo validador interno do Prisma v7
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "file:./dev.db"
}

// Conexão unificada do Banco de Dados FAB MAKERS (Local via dev.db ou Nuvem via Turso)

const libsql = createClient({
  url: process.env.TURSO_DATABASE_URL || "file:./dev.db",
  authToken: process.env.TURSO_AUTH_TOKEN || undefined,
})

const adapter = new PrismaLibSql(libsql as any)

// Evita a criação de múltiplas conexões com o PrismaClient no Next.js em ambiente de desenvolvimento
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma = globalForPrisma.prisma || new PrismaClient({ adapter })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma