import { semesterAverage, type GradeCalcRow } from "./grades";

export type SubjectCreditRow = {
  gradeObtained: number | null;
  credits: number;
};

/** Sum credits for subjects with grade ≥ pass threshold (spec §4.3). */
export function creditsValidated(
  rows: SubjectCreditRow[],
  passThreshold = 10
): number {
  return rows.reduce((sum, r) => {
    if (r.gradeObtained === null || r.gradeObtained < passThreshold) return sum;
    return sum + r.credits;
  }, 0);
}

/** Mean of semester averages when both semesters have data (spec §4.3). */
export function annualAverage(
  semesterAverages: (number | null)[]
): number | null {
  const valid = semesterAverages.filter(
    (a): a is number => a !== null && !Number.isNaN(a)
  );
  if (valid.length === 0) return null;
  const sum = valid.reduce((s, a) => s + a, 0);
  return Math.round((sum / valid.length) * 100) / 100;
}

export function buildSemesterAverageRows(
  grades: GradeCalcRow[]
): number | null {
  return semesterAverage(grades);
}
