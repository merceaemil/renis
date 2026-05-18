/** Server-side grade calculations (spec §4.3) — not persisted. */

export type GradeCalcRow = {
  gradeObtained: number | null;
  coefficient: number;
};

export function semesterAverage(grades: GradeCalcRow[]): number | null {
  const valid = grades.filter(
    (g) => g.gradeObtained !== null && !Number.isNaN(g.gradeObtained)
  );
  if (valid.length === 0) return null;

  const sumCoef = valid.reduce((s, g) => s + g.coefficient, 0);
  if (sumCoef === 0) return null;

  const weighted = valid.reduce(
    (s, g) => s + (g.gradeObtained as number) * g.coefficient,
    0
  );
  return Math.round((weighted / sumCoef) * 100) / 100;
}

export function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
