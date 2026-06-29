import { defineConfig } from "prisma/config";
import { createClient } from "@libsql/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  adapter: () => {
    const url = process.env.TURSO_DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;

    if (!url || url === "undefined" || url.trim() === "") {
      // Retorna null localmente para não bloquear a geração do client
      return null as any;
    }

    const client = createClient({ url, authToken: authToken || undefined });
    return new PrismaLibSql(client as any);
  },
});
