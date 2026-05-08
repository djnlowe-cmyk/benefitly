-- AlterTable: add region fields to User. SQLite-safe column additions with defaults.
ALTER TABLE "User" ADD COLUMN "country" TEXT NOT NULL DEFAULT 'GB';
ALTER TABLE "User" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'GBP';
