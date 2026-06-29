import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: (process.env.DATABASE_URL && process.env.DATABASE_URL !== "undefined" && process.env.DATABASE_URL !== "") 
      ? process.env.DATABASE_URL 
      : "file:./dev.db",
  },
  migrations: {
    path: "prisma/migrations",
  },
});
