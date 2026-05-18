ALTER TABLE "institutions" ADD COLUMN IF NOT EXISTS "grade_classifications" JSONB;
ALTER TABLE "institutions" ADD COLUMN IF NOT EXISTS "logo_object_key" TEXT;
ALTER TABLE "institutions" ADD COLUMN IF NOT EXISTS "signature_institution_object_key" TEXT;
ALTER TABLE "institutions" ADD COLUMN IF NOT EXISTS "signature_ministry_object_key" TEXT;
