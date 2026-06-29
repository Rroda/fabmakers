// Preinit: Garante que as variáveis de ambiente essenciais do banco estejam presentes antes do Prisma Client carregar
const rawTursoUrl = process.env.TURSO_DATABASE_URL;
const dbUrl = (rawTursoUrl && rawTursoUrl !== "undefined" && rawTursoUrl !== "") 
  ? rawTursoUrl 
  : "file:./dev.db";

if (!process.env.DATABASE_URL || process.env.DATABASE_URL === "undefined" || process.env.DATABASE_URL === "") {
  process.env.DATABASE_URL = dbUrl;
}
