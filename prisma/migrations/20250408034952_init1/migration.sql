/*
  Warnings:

  - Added the required column `average` to the `WeekScore` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "WeekScore" ADD COLUMN     "average" INTEGER NOT NULL;
