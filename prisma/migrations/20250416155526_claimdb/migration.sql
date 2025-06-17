-- CreateTable
CREATE TABLE "PlayerClaim" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PlayerClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Claimant" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,

    CONSTRAINT "Claimant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Claimant_userId_claimId_key" ON "Claimant"("userId", "claimId");

-- AddForeignKey
ALTER TABLE "PlayerClaim" ADD CONSTRAINT "PlayerClaim_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claimant" ADD CONSTRAINT "Claimant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claimant" ADD CONSTRAINT "Claimant_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "PlayerClaim"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
