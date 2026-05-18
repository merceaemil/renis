/** Configurable grade bands per institution (spec §4.3). */

export type GradeClassification = {
  min: number;
  max: number;
  label: string;
};

/** Default 20-point scale — Ministry can override per institution. */
export const DEFAULT_GRADE_CLASSIFICATIONS: GradeClassification[] = [
  { min: 0, max: 9.99, label: "Fail" },
  { min: 10, max: 11.99, label: "Passable" },
  { min: 12, max: 13.99, label: "Satisfactory" },
  { min: 14, max: 15.99, label: "Good" },
  { min: 16, max: 17.99, label: "Very good" },
  { min: 18, max: 20, label: "Excellent" },
];

export function parseGradeClassifications(
  value: unknown
): GradeClassification[] {
  if (!Array.isArray(value) || value.length === 0) {
    return DEFAULT_GRADE_CLASSIFICATIONS;
  }
  const parsed: GradeClassification[] = [];
  for (const item of value) {
    if (
      item &&
      typeof item === "object" &&
      "min" in item &&
      "max" in item &&
      "label" in item
    ) {
      const min = Number((item as GradeClassification).min);
      const max = Number((item as GradeClassification).max);
      const label = String((item as GradeClassification).label).trim();
      if (Number.isFinite(min) && Number.isFinite(max) && label) {
        parsed.push({ min, max, label });
      }
    }
  }
  return parsed.length > 0 ? parsed : DEFAULT_GRADE_CLASSIFICATIONS;
}

export function classifyAverage(
  average: number | null,
  rules: GradeClassification[]
): string | null {
  if (average === null || Number.isNaN(average)) return null;
  const band = rules.find((r) => average >= r.min && average <= r.max);
  return band?.label ?? null;
}
