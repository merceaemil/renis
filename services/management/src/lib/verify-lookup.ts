import { logAudit } from "@renis/core";
import { DiplomaStatus, GradeStatus, prisma } from "@renis/database";

export type VerifyLookupResult =
  | {
      status: "TRANSCRIPT";
      kind: "transcript";
      institution: string;
      programme: string;
      academicYear: string;
      semester: string;
      holder: string;
      verifiedAt: Date;
    }
  | {
      status: "PUBLISHED";
      kind: "diploma";
      type: string;
      title: string;
      programme: string | null;
      institution: string;
      graduationYear: number;
      honors: string | null;
      publishedAt: Date | null;
      holder: string;
    }
  | {
      status: "REVOKED";
      kind: "diploma";
      revokedAt: Date | null;
    }
  | {
      status: "UNKNOWN";
      message: string;
    };

function holderDisplayName(student: {
  firstName: string;
  lastName: string;
  nameConsent: boolean;
}): string {
  return student.nameConsent
    ? `${student.firstName} ${student.lastName}`
    : `${student.firstName.charAt(0)}.${student.lastName.charAt(0)}.`;
}

export async function lookupVerification(
  rawCode: string,
  options?: { ip?: string; audit?: boolean }
): Promise<VerifyLookupResult> {
  const code = rawCode.trim();
  if (!code) {
    return {
      status: "UNKNOWN",
      message: "Please enter a verification code.",
    };
  }

  const transcript = await prisma.transcriptRecord.findFirst({
    where: { verificationCode: { equals: code, mode: "insensitive" } },
    include: {
      institution: { select: { name: true } },
      student: {
        select: { firstName: true, lastName: true, nameConsent: true },
      },
      gradeSession: {
        select: {
          academicYear: true,
          semester: true,
          status: true,
          programme: { select: { name: true } },
        },
      },
    },
  });

  if (transcript) {
    if (options?.audit !== false) {
      await logAudit({
        action: "PUBLIC_TRANSCRIPT_VERIFY",
        entityType: "TranscriptRecord",
        entityId: transcript.id,
        metadata: { codePrefix: code.slice(0, 8) },
        ipAddress: options?.ip,
      }).catch(() => {});
    }

    if (transcript.gradeSession.status !== GradeStatus.SUBMITTED) {
      return {
        status: "UNKNOWN",
        message: "No transcript matches this code. Please check your entry.",
      };
    }

    return {
      status: "TRANSCRIPT",
      kind: "transcript",
      institution: transcript.institution.name,
      programme: transcript.gradeSession.programme.name,
      academicYear: transcript.gradeSession.academicYear,
      semester: transcript.gradeSession.semester,
      holder: holderDisplayName(transcript.student),
      verifiedAt: transcript.createdAt,
    };
  }

  if (options?.audit !== false) {
    await logAudit({
      action: "PUBLIC_DIPLOMA_VERIFY",
      entityType: "Diploma",
      metadata: { codePrefix: code.slice(0, 8) },
      ipAddress: options?.ip,
    }).catch(() => {});
  }

  const diploma = await prisma.diploma.findFirst({
    where: { uniqueCode: { equals: code, mode: "insensitive" } },
    include: {
      institution: { select: { name: true } },
      student: {
        select: { firstName: true, lastName: true, nameConsent: true },
      },
    },
  });

  if (!diploma) {
    return {
      status: "UNKNOWN",
      message: "No diploma or transcript matches this code. Please check your entry.",
    };
  }

  if (diploma.status === DiplomaStatus.REVOKED) {
    return {
      status: "REVOKED",
      kind: "diploma",
      revokedAt: diploma.revokedAt,
    };
  }

  if (diploma.status !== DiplomaStatus.PUBLISHED) {
    return {
      status: "UNKNOWN",
      message: "No diploma matches this code. Please check your entry.",
    };
  }

  return {
    status: "PUBLISHED",
    kind: "diploma",
    type: diploma.type,
    title: diploma.title,
    programme: diploma.programmeName,
    institution: diploma.institution.name,
    graduationYear: diploma.graduationYear,
    honors: diploma.honors,
    publishedAt: diploma.publishedAt,
    holder: holderDisplayName(diploma.student),
  };
}
