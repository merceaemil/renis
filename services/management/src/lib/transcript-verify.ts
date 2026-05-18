import { randomUUID } from "node:crypto";
import { prisma } from "@renis/database";
import { buildDiplomaVerifyUrl } from "@/lib/verify-url";

/** Stable verification code per student + submitted session; reused on re-download. */
export async function ensureTranscriptVerificationCode(
  institutionId: string,
  studentId: string,
  gradeSessionId: string
): Promise<string> {
  const existing = await prisma.transcriptRecord.findUnique({
    where: {
      gradeSessionId_studentId: { gradeSessionId, studentId },
    },
    select: { verificationCode: true },
  });
  if (existing) return existing.verificationCode;

  const created = await prisma.transcriptRecord.create({
    data: {
      verificationCode: randomUUID(),
      institutionId,
      studentId,
      gradeSessionId,
    },
    select: { verificationCode: true },
  });
  return created.verificationCode;
}

export function buildTranscriptVerifyUrl(code: string): string {
  return buildDiplomaVerifyUrl(code);
}
