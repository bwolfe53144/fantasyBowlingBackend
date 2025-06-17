/*
  Warnings:

  - Added the required column `points` to the `WeekScore` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "WeekScore" ADD COLUMN     "points" INTEGER NOT NULL;
