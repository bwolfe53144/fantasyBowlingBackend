/*
  Warnings:

  - Added the required column `myTeam` to the `WeekScore` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "WeekScore" ADD COLUMN     "myTeam" TEXT NOT NULL;
