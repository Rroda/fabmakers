import { PrismaClient } from '@prisma/client'
import { createClient } from '@libsql/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'

// 1. Resolve a URL do banco (Local via SQLite ou Nuvem via Turso)
const rawTursoUrl = process.env.TURSO_DATABASE_URL;
const dbUrl = (rawTursoUrl && rawTursoUrl !== "undefined" && rawTursoUrl !== "") 
  ? rawTursoUrl 
  : "file:./dev.db";

// 2. Injeta de forma resiliente na variável que o validador interno do Prisma v7 exige
if (!process.env.DATABASE_URL || process.env.DATABASE_URL === "undefined" || process.env.DATABASE_URL === "") {
  try {
    Object.defineProperty(process.env, 'DATABASE_URL', {
      value: dbUrl,
      writable: true,
      configurable: true,
      enumerable: true
    });
  } catch (e) {
    process.env.DATABASE_URL = dbUrl;
  }
}

// 3. Cria a conexão física do LibSQL
const libsql = createClient({
  url: dbUrl,
  authToken: process.env.TURSO_AUTH_TOKEN && process.env.TURSO_AUTH_TOKEN !== "undefined" ? process.env.TURSO_AUTH_TOKEN : undefined,
})

const adapter = new PrismaLibSql(libsql as any)

// Evita a criação de múltiplas conexões com o PrismaClient no Next.js em ambiente de desenvolvimento
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

// 4. Instancia o PrismaClient
export const prisma = globalForPrisma.prisma || new PrismaClient({ adapter })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma