-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "verificationToken" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "MakerProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "machines" TEXT NOT NULL,
    "materials" TEXT NOT NULL,
    "availability" TEXT NOT NULL DEFAULT '{}',
    "rating" REAL NOT NULL DEFAULT 5.0,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "penaltiesCount" INTEGER NOT NULL DEFAULT 0,
    "isBanned" BOOLEAN NOT NULL DEFAULT false,
    "contractAccepted" BOOLEAN NOT NULL DEFAULT false,
    "kycStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "makerStatus" TEXT NOT NULL DEFAULT 'UNVERIFIED',
    "kycDocumentUrl" TEXT,
    "kycSelfieUrl" TEXT,
    "calibX" REAL,
    "calibY" REAL,
    "calibZ" REAL,
    "calibImageUrl" TEXT,
    CONSTRAINT "MakerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DesignerProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "paypalEmail" TEXT,
    "rating" REAL NOT NULL DEFAULT 5.0,
    CONSTRAINT "DesignerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Model3D" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "gcodeStream" BOOLEAN NOT NULL DEFAULT true,
    "royaltyPrice" REAL NOT NULL,
    "designerId" TEXT NOT NULL,
    CONSTRAINT "Model3D_designerId_fkey" FOREIGN KEY ("designerId") REFERENCES "DesignerProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL,
    "totalPrice" REAL NOT NULL,
    "makerPrice" REAL NOT NULL,
    "royaltyPaid" REAL NOT NULL,
    "platformFee" REAL NOT NULL,
    "shippingZip" TEXT NOT NULL,
    "shippingAddress" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "makerId" TEXT,
    "modelId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Order_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Order_makerId_fkey" FOREIGN KEY ("makerId") REFERENCES "MakerProfile" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Order_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "Model3D" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PrinterModel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "brand" TEXT NOT NULL,
    "modelName" TEXT NOT NULL,
    "technology" TEXT NOT NULL,
    "volumeX" REAL NOT NULL,
    "volumeY" REAL NOT NULL,
    "volumeZ" REAL NOT NULL,
    "hasEnclosure" BOOLEAN NOT NULL,
    "hasMulticolor" BOOLEAN NOT NULL,
    "maxNozzleTemp" INTEGER NOT NULL,
    "maxBedTemp" INTEGER NOT NULL,
    "compatibleMaterials" TEXT NOT NULL,
    "supportedNozzles" TEXT NOT NULL,
    "typicalPrecision" REAL NOT NULL,
    "maxSpeed" INTEGER NOT NULL,
    "maxPartWeightG" REAL NOT NULL,
    "releaseYear" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "MakerProfile_userId_key" ON "MakerProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DesignerProfile_userId_key" ON "DesignerProfile"("userId");

