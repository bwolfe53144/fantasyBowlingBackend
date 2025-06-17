/*
  Warnings:

  - You are about to drop the column `games` on the `Player` table. All the data in the column will be lost.
  - You are about to drop the column `pins` on the `Player` table. All the data in the column will be lost.
  - You are about to drop the column `points` on the `Player` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Player" DROP COLUMN "games",
DROP COLUMN "pins",
DROP COLUMN "points";
