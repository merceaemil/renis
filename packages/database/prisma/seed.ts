import {
  DiplomaStatus,
  GradeStatus,
  PrismaClient,
  Semester,
  UserRole,
  UserStatus,
} from "@prisma/client";

const DEFAULT_GRADE_CLASSIFICATIONS = [
  { min: 0, max: 9.99, label: "Fail" },
  { min: 10, max: 11.99, label: "Passable" },
  { min: 12, max: 13.99, label: "Satisfactory" },
  { min: 14, max: 15.99, label: "Good" },
  { min: 16, max: 17.99, label: "Very good" },
  { min: 18, max: 20, label: "Excellent" },
];

const DEMO_VERIFY_CODE = "00000000-0000-4000-a000-000000000001";
const DEMO_TRANSCRIPT_CODE = "00000000-0000-4000-a000-000000000002";

const prisma = new PrismaClient();

async function main() {
  const institution = await prisma.institution.upsert({
    where: { code: "UB" },
    update: {
      gradeClassifications: DEFAULT_GRADE_CLASSIFICATIONS,
    },
    create: {
      code: "UB",
      name: "University of Burundi (pilot)",
      gradeClassifications: DEFAULT_GRADE_CLASSIFICATIONS,
    },
  });

  await prisma.user.upsert({
    where: { email: "super.admin@renis.bi" },
    update: {},
    create: {
      keycloakId: "seed-super-admin",
      email: "super.admin@renis.bi",
      firstName: "Super",
      lastName: "Admin",
      role: UserRole.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
    },
  });

  await prisma.user.upsert({
    where: { email: "ministry.admin@renis.bi" },
    update: {},
    create: {
      keycloakId: "seed-ministry-admin",
      email: "ministry.admin@renis.bi",
      firstName: "Ministry",
      lastName: "Admin",
      role: UserRole.MINISTRY_ADMIN,
      status: UserStatus.ACTIVE,
    },
  });

  await prisma.user.upsert({
    where: { email: "ub.admin@renis.bi" },
    update: { institutionId: institution.id },
    create: {
      keycloakId: "seed-ub-admin",
      email: "ub.admin@renis.bi",
      firstName: "UB",
      lastName: "Admin",
      role: UserRole.INSTITUTION_ADMIN,
      status: UserStatus.ACTIVE,
      institutionId: institution.id,
    },
  });

  const programme = await prisma.programme.upsert({
    where: {
      institutionId_code: { institutionId: institution.id, code: "INFO" },
    },
    update: {},
    create: {
      institutionId: institution.id,
      code: "INFO",
      name: "Licence en Informatique",
    },
  });

  const subjectDefs = [
    { code: "ALG1", name: "Algorithmes I", semester: Semester.S1, yearLevel: 1, coefficient: 2 },
    { code: "BD1", name: "Bases de données I", semester: Semester.S1, yearLevel: 1, coefficient: 1.5 },
    { code: "WEB1", name: "Développement Web I", semester: Semester.S2, yearLevel: 1, coefficient: 1.5 },
  ] as const;

  for (const s of subjectDefs) {
    await prisma.subject.upsert({
      where: {
        programmeId_code_semester: {
          programmeId: programme.id,
          code: s.code,
          semester: s.semester,
        },
      },
      update: {},
      create: {
        programmeId: programme.id,
        name: s.name,
        code: s.code,
        credits: 6,
        coefficient: s.coefficient,
        semester: s.semester,
        yearLevel: s.yearLevel,
      },
    });
  }

  const pilotStudents = [
    { studentIdNumber: "UB-2024-001", firstName: "Alice", lastName: "Nkurunziza" },
    { studentIdNumber: "UB-2024-002", firstName: "Bob", lastName: "Mugisha" },
    { studentIdNumber: "UB-2024-003", firstName: "Claire", lastName: "Habiyaremye" },
  ];

  const studentIds: string[] = [];
  for (const s of pilotStudents) {
    const row = await prisma.student.upsert({
      where: {
        institutionId_studentIdNumber: {
          institutionId: institution.id,
          studentIdNumber: s.studentIdNumber,
        },
      },
      update: {},
      create: {
        institutionId: institution.id,
        ...s,
        nameConsent: true,
      },
    });
    studentIds.push(row.id);
  }

  for (const studentId of studentIds) {
    await prisma.programmeEnrollment.upsert({
      where: {
        studentId_programmeId: { studentId, programmeId: programme.id },
      },
      update: { active: true, yearLevel: 1 },
      create: {
        studentId,
        programmeId: programme.id,
        yearLevel: 1,
        active: true,
      },
    });
  }

  const gradeSession = await prisma.gradeSession.upsert({
    where: {
      programmeId_academicYear_semester: {
        programmeId: programme.id,
        academicYear: "2024-2025",
        semester: Semester.S1,
      },
    },
    update: {
      status: GradeStatus.SUBMITTED,
      submittedAt: new Date("2024-12-01"),
    },
    create: {
      institutionId: institution.id,
      programmeId: programme.id,
      academicYear: "2024-2025",
      semester: Semester.S1,
      status: GradeStatus.SUBMITTED,
      submittedAt: new Date("2024-12-01"),
    },
  });

  const subjects = await prisma.subject.findMany({
    where: { programmeId: programme.id, semester: Semester.S1 },
  });
  const demoGrades: Record<string, number> = {
    "UB-2024-001": 14,
    "UB-2024-002": 12,
    "UB-2024-003": 16,
  };
  for (const sid of studentIds) {
    const st = await prisma.student.findUnique({ where: { id: sid } });
    if (!st) continue;
    const score = demoGrades[st.studentIdNumber] ?? 13;
    for (const sub of subjects) {
      await prisma.grade.upsert({
        where: {
          sessionId_studentId_subjectId: {
            sessionId: gradeSession.id,
            studentId: sid,
            subjectId: sub.id,
          },
        },
        update: { gradeObtained: score, status: GradeStatus.SUBMITTED },
        create: {
          sessionId: gradeSession.id,
          studentId: sid,
          subjectId: sub.id,
          gradeObtained: score,
          status: GradeStatus.SUBMITTED,
          submittedAt: new Date("2024-12-01"),
        },
      });
    }
  }

  if (studentIds[0]) {
    await prisma.transcriptRecord.upsert({
      where: {
        gradeSessionId_studentId: {
          gradeSessionId: gradeSession.id,
          studentId: studentIds[0]!,
        },
      },
      update: { verificationCode: DEMO_TRANSCRIPT_CODE },
      create: {
        verificationCode: DEMO_TRANSCRIPT_CODE,
        institutionId: institution.id,
        studentId: studentIds[0]!,
        gradeSessionId: gradeSession.id,
      },
    });
  }

  const demoStudent = await prisma.student.findFirst({
    where: {
      institutionId: institution.id,
      studentIdNumber: "UB-2024-001",
    },
  });

  if (demoStudent) {
    await prisma.diploma.upsert({
      where: { uniqueCode: DEMO_VERIFY_CODE },
      update: {
        status: DiplomaStatus.PUBLISHED,
        submittedAt: new Date("2024-06-01"),
        publishedAt: new Date(),
      },
      create: {
        uniqueCode: DEMO_VERIFY_CODE,
        institutionId: institution.id,
        studentId: demoStudent.id,
        type: "BACHELOR",
        title: "Bachelor of Computer Science (demo)",
        graduationYear: 2024,
        honors: "Distinction",
        status: DiplomaStatus.PUBLISHED,
        submittedAt: new Date("2024-06-01"),
        publishedAt: new Date(),
      },
    });
  }

  console.log("Seed OK — institution:", institution.name);
  console.log("  Institution admin: ub.admin@renis.bi (Keycloak: UbAdmin123!)");
  console.log("  Ministry admin: ministry.admin@renis.bi (Keycloak: MinistryAdmin123!)");
  console.log("  Widget demo diploma code:", DEMO_VERIFY_CODE);
  console.log("  Widget demo transcript code:", DEMO_TRANSCRIPT_CODE);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
