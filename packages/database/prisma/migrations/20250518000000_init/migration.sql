-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'MINISTRY_ADMIN', 'INSTITUTION_ADMIN');
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "Semester" AS ENUM ('S1', 'S2');
CREATE TYPE "GradeStatus" AS ENUM ('DRAFT', 'SUBMITTED');
CREATE TYPE "DiplomaStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'PUBLISHED', 'REVOKED');

CREATE TABLE "institutions" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "institutions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "keycloak_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "institution_id" TEXT,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "students" (
    "id" TEXT NOT NULL,
    "institution_id" TEXT NOT NULL,
    "student_id_number" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "date_of_birth" TIMESTAMP(3),
    "name_consent" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "students_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "programmes" (
    "id" TEXT NOT NULL,
    "institution_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "programmes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "subjects" (
    "id" TEXT NOT NULL,
    "programme_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "credits" INTEGER NOT NULL DEFAULT 0,
    "coefficient" DECIMAL(5,2) NOT NULL DEFAULT 1,
    "semester" "Semester" NOT NULL,
    "year_level" INTEGER NOT NULL,
    CONSTRAINT "subjects_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "grade_sessions" (
    "id" TEXT NOT NULL,
    "institution_id" TEXT NOT NULL,
    "programme_id" TEXT NOT NULL,
    "academic_year" TEXT NOT NULL,
    "semester" "Semester" NOT NULL,
    "status" "GradeStatus" NOT NULL DEFAULT 'DRAFT',
    "submitted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "grade_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "grades" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "subject_id" TEXT NOT NULL,
    "grade_obtained" DECIMAL(5,2),
    "grade_max" DECIMAL(5,2) NOT NULL DEFAULT 20,
    "status" "GradeStatus" NOT NULL DEFAULT 'DRAFT',
    "entered_by_id" TEXT,
    "submitted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "grades_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "diplomas" (
    "id" TEXT NOT NULL,
    "unique_code" TEXT NOT NULL,
    "institution_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "graduation_year" INTEGER NOT NULL,
    "honors" TEXT,
    "status" "DiplomaStatus" NOT NULL DEFAULT 'DRAFT',
    "pdf_path" TEXT,
    "pdf_hash" TEXT,
    "published_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "revocation_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "diplomas_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity_type" TEXT,
    "entity_id" TEXT,
    "actor_email" TEXT,
    "metadata" JSONB,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "institutions_code_key" ON "institutions"("code");
CREATE UNIQUE INDEX "users_keycloak_id_key" ON "users"("keycloak_id");
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE INDEX "users_institution_id_idx" ON "users"("institution_id");
CREATE UNIQUE INDEX "students_institution_id_student_id_number_key" ON "students"("institution_id", "student_id_number");
CREATE UNIQUE INDEX "programmes_institution_id_code_key" ON "programmes"("institution_id", "code");
CREATE UNIQUE INDEX "subjects_programme_id_code_semester_key" ON "subjects"("programme_id", "code", "semester");
CREATE UNIQUE INDEX "grade_sessions_programme_id_academic_year_semester_key" ON "grade_sessions"("programme_id", "academic_year", "semester");
CREATE UNIQUE INDEX "grades_session_id_student_id_subject_id_key" ON "grades"("session_id", "student_id", "subject_id");
CREATE UNIQUE INDEX "diplomas_unique_code_key" ON "diplomas"("unique_code");
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

ALTER TABLE "users" ADD CONSTRAINT "users_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "users" ADD CONSTRAINT "users_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "students" ADD CONSTRAINT "students_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "programmes" ADD CONSTRAINT "programmes_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_programme_id_fkey" FOREIGN KEY ("programme_id") REFERENCES "programmes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "grade_sessions" ADD CONSTRAINT "grade_sessions_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "grade_sessions" ADD CONSTRAINT "grade_sessions_programme_id_fkey" FOREIGN KEY ("programme_id") REFERENCES "programmes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "grades" ADD CONSTRAINT "grades_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "grade_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "grades" ADD CONSTRAINT "grades_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "grades" ADD CONSTRAINT "grades_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "diplomas" ADD CONSTRAINT "diplomas_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "diplomas" ADD CONSTRAINT "diplomas_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
