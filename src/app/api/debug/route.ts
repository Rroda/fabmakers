export const dynamic = 'force-dynamic'

export async function GET() {
  const tursoUrl = process.env.TURSO_DATABASE_URL
  const dbUrl = process.env.DATABASE_URL
  const authToken = process.env.TURSO_AUTH_TOKEN

  return Response.json({
    TURSO_DATABASE_URL: tursoUrl
      ? `SET ✅ (começa com: ${tursoUrl.substring(0, 20)}...)`
      : 'NÃO DEFINIDA ❌',
    DATABASE_URL: dbUrl
      ? `SET ✅ (começa com: ${dbUrl.substring(0, 20)}...)`
      : 'NÃO DEFINIDA ❌',
    TURSO_AUTH_TOKEN: authToken
      ? `SET ✅ (tamanho: ${authToken.length} chars)`
      : 'NÃO DEFINIDA ❌',
    NODE_ENV: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  })
}
