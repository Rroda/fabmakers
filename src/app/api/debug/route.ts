export const dynamic = 'force-dynamic'
import { createClient } from '@libsql/client'

export async function GET() {
  const tursoUrl = process.env.TURSO_DATABASE_URL
  const authToken = process.env.TURSO_AUTH_TOKEN

  const result: Record<string, unknown> = {
    TURSO_DATABASE_URL: tursoUrl ? `SET ✅ (${tursoUrl.substring(0, 30)}...)` : 'NÃO DEFINIDA ❌',
    TURSO_AUTH_TOKEN: authToken ? `SET ✅ (${authToken.length} chars)` : 'NÃO DEFINIDA ❌',
    NODE_ENV: process.env.NODE_ENV,
  }

  // Testa conexão DIRETA com o libsql (sem Prisma)
  if (tursoUrl && tursoUrl !== 'undefined') {
    try {
      const client = createClient({
        url: tursoUrl,
        authToken: authToken && authToken !== 'undefined' ? authToken : undefined,
      })
      const res = await client.execute('SELECT 1 as ping')
      result.libsql_direct = `CONECTADO ✅ - rows: ${res.rows.length}`
    } catch (e: unknown) {
      result.libsql_direct = `ERRO ❌: ${e instanceof Error ? e.message : String(e)}`
    }
  } else {
    result.libsql_direct = 'URL não disponível para testar'
  }

  // Testa conexão via PRISMA
  try {
    const { prisma } = await import('@/lib/db')
    const count = await prisma.$queryRaw`SELECT 1 as ping`
    result.prisma_connection = `CONECTADO ✅ - resultado: ${JSON.stringify(count)}`
  } catch (e: unknown) {
    result.prisma_connection = `ERRO ❌: ${e instanceof Error ? e.message : String(e)}`
  }

  // Testa query na tabela User
  try {
    const { prisma } = await import('@/lib/db')
    const userCount = await prisma.user.count()
    result.prisma_user_count = `OK ✅ - total de users: ${userCount}`
  } catch (e: unknown) {
    result.prisma_user_count = `ERRO ❌: ${e instanceof Error ? e.message : String(e)}`
  }

  return Response.json(result)
}
