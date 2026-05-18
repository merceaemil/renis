-- Programme enrollment (spec §4.1)
CREATE TABLE "programme_enrollments" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "programme_id" TEXT NOT NULL,
    "year_level" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "programme_enrollments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "programme_enrollments_student_id_programme_id_key" ON "programme_enrollments"("student_id", "programme_id");
CREATE INDEX "programme_enrollments_programme_id_idx" ON "programme_enrollments"("programme_id");

ALTER TABLE "programme_enrollments" ADD CONSTRAINT "programme_enrollments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "programme_enrollments" ADD CONSTRAINT "programme_enrollments_programme_id_fkey" FOREIGN KEY ("programme_id") REFERENCES "programmes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Transcript verification codes (spec §4.4 — QR on transcript PDF)
CREATE TABLE "transcript_records" (
    "id" TEXT NOT NULL,
    "verification_code" TEXT NOT NULL,
    "institution_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "grade_session_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transcript_records_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "transcript_records_verification_code_key" ON "transcript_records"("verification_code");
CREATE UNIQUE INDEX "transcript_records_grade_session_id_student_id_key" ON "transcript_records"("grade_session_id", "student_id");

ALTER TABLE "transcript_records" ADD CONSTRAINT "transcript_records_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "transcript_records" ADD CONSTRAINT "transcript_records_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "transcript_records" ADD CONSTRAINT "transcript_records_grade_session_id_fkey" FOREIGN KEY ("grade_session_id") REFERENCES "grade_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Institution pass threshold for credits validated (spec §4.3)
ALTER TABLE "institutions" ADD COLUMN "pass_grade_threshold" DECIMAL(5,2) NOT NULL DEFAULT 10;

-- Diploma metadata (spec §5)
ALTER TABLE "diplomas" ADD COLUMN "programme_name" TEXT;
ALTER TABLE "diplomas" ADD COLUMN "created_by_id" TEXT;

ALTER TABLE "diplomas" ADD CONSTRAINT "diplomas_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
