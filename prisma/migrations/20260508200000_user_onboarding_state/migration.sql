-- AlterTable: add onboardingState column with safe default
ALTER TABLE "User" ADD COLUMN "onboardingState" TEXT NOT NULL DEFAULT 'fresh';

-- Backfill: anyone with at least one Coverage at migration time is past onboarding.
-- New users (added after this migration) get the column default ('fresh').
UPDATE "User"
SET "onboardingState" = 'done'
WHERE "id" IN (SELECT DISTINCT "userId" FROM "Coverage");
