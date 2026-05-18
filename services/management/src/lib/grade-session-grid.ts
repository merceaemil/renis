import {
  annualAverage,
  creditsValidated,
  semesterAverage,
  toNumber,
} from "@renis/core";
import { GradeStatus, prisma, Semester } from "@renis/database";

export async function loadGradeSessionGrid(sessionId: string, institutionId?: string) {
  const session = await prisma.gradeSession.findFirst({
    where: {
      id: sessionId,
      ...(institutionId ? { institutionId } : {}),
    },
    include: {
      programme: true,
      institution: {
        select: {
          id: true,
          name: true,
          code: true,
          passGradeThreshold: true,
        },
      },
    },
  });
  if (!session) return null;

  const passThreshold = toNumber(session.institution.passGradeThreshold) ?? 10;

  const [subjects, enrollments, grades] = await Promise.all([
    prisma.subject.findMany({
      where: { programmeId: session.programmeId, semester: session.semester },
      orderBy: [{ yearLevel: "asc" }, { code: "asc" }],
    }),
    prisma.programmeEnrollment.findMany({
      where: { programmeId: session.programmeId, active: true },
      select: { studentId: true },
    }),
    prisma.grade.findMany({ where: { sessionId } }),
  ]);

  const enrolledIds = new Set(enrollments.map((e) => e.studentId));
  const students = await prisma.student.findMany({
    where: {
      institutionId: session.institutionId,
      active: true,
      id: { in: enrolledIds.size > 0 ? [...enrolledIds] : [] },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  const otherSemester = session.semester === Semester.S1 ? Semester.S2 : Semester.S1;
  const siblingSession = await prisma.gradeSession.findFirst({
    where: {
      programmeId: session.programmeId,
      academicYear: session.academicYear,
      semester: otherSemester,
      status: GradeStatus.SUBMITTED,
    },
    select: { id: true },
  });

  let siblingGrades: typeof grades = [];
  let siblingSubjects: typeof subjects = [];
  if (siblingSession) {
    [siblingGrades, siblingSubjects] = await Promise.all([
      prisma.grade.findMany({ where: { sessionId: siblingSession.id } }),
      prisma.subject.findMany({
        where: {
          programmeId: session.programmeId,
          semester: otherSemester,
        },
      }),
    ]);
  }

  const gradeMap = new Map(
    grades.map((g) => [`${g.studentId}:${g.subjectId}`, g])
  );
  const siblingGradeMap = new Map(
    siblingGrades.map((g) => [`${g.studentId}:${g.subjectId}`, g])
  );

  const studentRows = students.map((student) => {
    const subjectGrades = subjects.map((subject) => {
      const key = `${student.id}:${subject.id}`;
      const g = gradeMap.get(key);
      return {
        subjectId: subject.id,
        subjectCode: subject.code,
        gradeObtained: g?.gradeObtained != null ? Number(g.gradeObtained) : null,
        gradeMax: g?.gradeMax != null ? Number(g.gradeMax) : 20,
        gradeId: g?.id ?? null,
      };
    });
    const avg = semesterAverage(
      subjectGrades.map((sg, i) => ({
        gradeObtained: sg.gradeObtained,
        coefficient: toNumber(subjects[i]!.coefficient) ?? 1,
      }))
    );

    const credits = creditsValidated(
      subjectGrades.map((sg, i) => ({
        gradeObtained: sg.gradeObtained,
        credits: subjects[i]!.credits,
      })),
      passThreshold
    );

    let siblingAvg: number | null = null;
    if (siblingSession && siblingSubjects.length > 0) {
      const siblingRows = siblingSubjects.map((subject) => {
        const g = siblingGradeMap.get(`${student.id}:${subject.id}`);
        return {
          gradeObtained: g?.gradeObtained != null ? Number(g.gradeObtained) : null,
          coefficient: toNumber(subject.coefficient) ?? 1,
        };
      });
      siblingAvg = semesterAverage(siblingRows);
    }

    const yearAvg =
      session.semester === Semester.S1
        ? annualAverage([avg, siblingAvg])
        : annualAverage([siblingAvg, avg]);

    return {
      student,
      grades: subjectGrades,
      semesterAverage: avg,
      creditsValidated: credits,
      annualAverage: yearAvg,
    };
  });

  const expectedCells = students.length * subjects.length;
  const filledCells = grades.filter((g) => g.gradeObtained !== null).length;
  const studentsWithMissingGrades = studentRows.filter((r) =>
    r.grades.some((g) => g.gradeObtained === null)
  ).length;

  return {
    session,
    subjects,
    students: studentRows,
    enrollmentCount: enrolledIds.size,
    stats: {
      studentCount: students.length,
      subjectCount: subjects.length,
      expectedCells,
      filledCells,
      studentsWithMissingGrades,
      completionPercent:
        expectedCells > 0 ? Math.round((filledCells / expectedCells) * 100) : 0,
      noEnrollments: enrolledIds.size === 0,
    },
  };
}
