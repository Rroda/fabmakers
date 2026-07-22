import path from "node:path";
import { defineConfig } from "prisma/config";

const localDb = path.join(process.cwd(), "prisma", "dev.db").replace(/\\/g, "/");

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Turso em produção via TURSO_*; local = sempre prisma/dev.db (não ./dev.db na raiz)
    url:
      process.env.TURSO_DATABASE_URL &&
      process.env.TURSO_DATABASE_URL.startsWith("libsql")
        ? process.env.TURSO_DATABASE_URL
        : `file:${localDb}`,
  },
});
