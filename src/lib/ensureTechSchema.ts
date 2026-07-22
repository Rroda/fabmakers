/** Garante tabelas L2 no SQLite/Turso (CREATE IF NOT EXISTS). */
export async function ensureTechSchema(prisma: {
  $executeRawUnsafe: (sql: string) => Promise<unknown>;
}): Promise<void> {
  const stmts = [
    `CREATE TABLE IF NOT EXISTS "TechnicianProfile" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "userId" TEXT NOT NULL UNIQUE,
      "city" TEXT NOT NULL DEFAULT '',
      "state" TEXT NOT NULL DEFAULT '',
      "specialties" TEXT NOT NULL DEFAULT '[]',
      "isApproved" BOOLEAN NOT NULL DEFAULT false,
      "rating" REAL NOT NULL DEFAULT 5.0,
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS "TechRequest" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "status" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "description" TEXT NOT NULL,
      "machineBrand" TEXT,
      "machineModel" TEXT,
      "zipCode" TEXT NOT NULL,
      "makerUserId" TEXT NOT NULL,
      "technicianId" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("makerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
      FOREIGN KEY ("technicianId") REFERENCES "TechnicianProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE
    )`,
  ];
  for (const sql of stmts) {
    try {
      await prisma.$executeRawUnsafe(sql);
    } catch {
      /* ignore */
    }
  }
}
