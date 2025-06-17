/*
  Warnings:

  - Added the required column `expiresAt` to the `PlayerClaim` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Claimant" ADD COLUMN     "dropPlayerId" TEXT;

-- AlterTable
ALTER TABLE "PlayerClaim" ADD COLUMN     "expiresAt" TIMESTAMP(3) NOT NULL;

-- AddForeignKey
ALTER TABLE "Claimant" ADD CONSTRAINT "Claimant_dropPlayerId_fkey" FOREIGN KEY ("dropPlayerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;
