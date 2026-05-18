import { semesterAverage, type GradeCalcRow } from "@renis/core";

export type GradeAnomaly = {
  code: string;
  message: string;
  studentId?: string;
};

export type GradeAnomalyRow = {
  studentId: string;
  studentLabel?: string;
  gradeObtained: number | null;
  gradeMax: number;
  coefficient: number;
};

function studentSuffix(label?: string): string {
  return label ? ` — ${label}` : "";
}

export function detectSessionAnomalies(rows: GradeAnomalyRow[]): GradeAnomaly[] {
  const anomalies: GradeAnomaly[] = [];
  const byStudent = new Map<
    string,
    { grades: GradeCalcRow[]; label?: string }
  >();

  for (const row of rows) {
    const g = row.gradeObtained;
    if (g !== null && g > row.gradeMax) {
      anomalies.push({
        code: "GRADE_ABOVE_MAX",
        message: `Grade ${g} exceeds maximum ${row.gradeMax}${studentSuffix(row.studentLabel)}`,
        studentId: row.studentId,
      });
    }
    const bucket = byStudent.get(row.studentId);
    if (bucket) {
      bucket.grades.push({
        gradeObtained: g,
        coefficient: row.coefficient,
      });
      if (!bucket.label && row.studentLabel) {
        bucket.label = row.studentLabel;
      }
    } else {
      byStudent.set(row.studentId, {
        grades: [{ gradeObtained: g, coefficient: row.coefficient }],
        label: row.studentLabel,
      });
    }
  }

  for (const [studentId, { grades, label }] of byStudent) {
    const avg = semesterAverage(grades);
    if (avg === null) continue;
    const avgText = avg.toFixed(2);
    const suffix = studentSuffix(label);
    if (avg > 18) {
      anomalies.push({
        code: "HIGH_SEMESTER_AVERAGE",
        message: `Semester average ${avgText} is unusually high${suffix}`,
        studentId,
      });
    } else if (avg < 8 && grades.some((g) => g.gradeObtained !== null)) {
      anomalies.push({
        code: "LOW_SEMESTER_AVERAGE",
        message: `Semester average ${avgText} is unusually low${suffix}`,
        studentId,
      });
    }
  }

  return anomalies;
}
