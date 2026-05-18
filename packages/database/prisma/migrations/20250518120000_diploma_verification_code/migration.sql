-- Verification code is assigned at submission only (spec §5.2)
ALTER TABLE "diplomas" ALTER COLUMN "unique_code" DROP DEFAULT;
ALTER TABLE "diplomas" ALTER COLUMN "unique_code" DROP NOT NULL;
ALTER TABLE "diplomas" ADD COLUMN IF NOT EXISTS "submitted_at" TIMESTAMP(3);
