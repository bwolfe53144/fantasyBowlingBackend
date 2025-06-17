/*
  Warnings:

  - Added the required column `date` to the `Match` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "date" TIMESTAMP(3) NOT NULL;

-- CreateTable
CREATE TABLE "WeekLock" (
    "id" TEXT NOT NULL,
    "league" TEXT NOT NULL,
    "season" INTEGER NOT NULL,
    "week" INTEGER NOT NULL,
    "lockTime" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeekLock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WeekLock_league_season_week_key" ON "WeekLock"("league", "season", "week");

-- CreateIndex
CREATE INDEX "Match_week_season_idx" ON "Match"("week", "season");
