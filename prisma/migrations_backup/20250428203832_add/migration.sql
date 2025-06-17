/*
  Warnings:

  - Added the required column `lanes` to the `WeekScore` table without a default value. This is not possible if the table is not empty.
  - Added the required column `opponent` to the `WeekScore` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "WeekScore" ADD COLUMN     "lanes" TEXT NOT NULL,
ADD COLUMN     "opponent" TEXT NOT NULL;
