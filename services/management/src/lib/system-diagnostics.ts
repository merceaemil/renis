import { HeadBucketCommand, S3Client } from "@aws-sdk/client-s3";
import { getMinioBucket } from "@renis/core/minio";
import { getKeycloakInternalIssuer } from "@renis/core/keycloak-url";
import {
  DiplomaStatus,
  GradeStatus,
  prisma,
  UserRole,
} from "@renis/database";

export type ConfigCheckStatus = "ok" | "missing" | "optional";

export type ConfigCheck = {
  key: string;
  label: string;
  value: string | null;
  status: ConfigCheckStatus;
  hint?: string;
};

export type DiagnosticsPayload = {
  checkedAt: string;
  version: string;
  environment: string;
  overall: "healthy" | "degraded" | "unhealthy";
  issues: string[];
  database: { ok: boolean; latencyMs: number | null; error?: string };
  storage: {
    configured: boolean;
    ok: boolean;
    bucket: string;
    endpoint: string | null;
    error?: string;
  };
  keycloak: {
    configured: boolean;
    ok: boolean;
    issuer: string | null;
    error?: string;
  };
  config: ConfigCheck[];
  counts: {
    institutions: number;
    institutionsActive: number;
    institutionsInactive: number;
    users: number;
    students: number;
    programmes: number;
    subjects: number;
    gradeSessions: number;
    grades: number;
    diplomas: number;
    enrollments: number;
    transcriptRecords: number;
    auditLogs: number;
  };
  breakdown: {
    diplomasByStatus: Record<string, number>;
    gradeSessionsByStatus: Record<string, number>;
    usersByRole: Record<string, number>;
  };
  activity: {
    lastAuditAt: string | null;
    lastAuditAction: string | null;
    lastSubmittedGradeSessionAt: string | null;
    auditLast24h: number;
    topAuditActions: { action: string; count: number }[];
  };
  services: {
    managementPublicUrl: string | null;
    qrVerifyBaseUrl: string | null;
    keycloakIssuer: string | null;
    keycloakAdminUrl: string | null;
    widgetPublicUrl: string | null;
    typo3BaseUrl: string | null;
    minioEndpoint: string | null;
    minioPublicUrl: string | null;
    smtpHost: string | null;
  };
};

async function checkDatabase(): Promise<{
  ok: boolean;
  latencyMs: number | null;
  error?: string;
}> {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true, latencyMs: Date.now() - start };
  } catch (e) {
    return {
      ok: false,
      latencyMs: null,
      error: e instanceof Error ? e.message : "Query failed",
    };
  }
}

async function probeMinioEndpoint(endpoint: string, bucket: string) {
  const client = new S3Client({
    endpoint,
    region: process.env.MINIO_REGION ?? "us-east-1",
    credentials: {
      accessKeyId: process.env.MINIO_ROOT_USER ?? "minioadmin",
      secretAccessKey: process.env.MINIO_ROOT_PASSWORD ?? "minioadmin",
    },
    forcePathStyle: true,
  });
  await client.send(new HeadBucketCommand({ Bucket: bucket }));
}

async function checkMinio(): Promise<{
  configured: boolean;
  ok: boolean;
  bucket: string;
  endpoint: string | null;
  error?: string;
}> {
  const bucket = getMinioBucket();
  const candidates = [
    process.env.MINIO_ENDPOINT,
    process.env.MINIO_PUBLIC_URL,
  ].filter((v): v is string => Boolean(v?.trim()));

  if (candidates.length === 0) {
    return { configured: false, ok: false, bucket, endpoint: null };
  }

  let lastError = "Bucket unreachable";
  for (const endpoint of [...new Set(candidates)]) {
    try {
      await probeMinioEndpoint(endpoint, bucket);
      return { configured: true, ok: true, bucket, endpoint };
    } catch (e) {
      lastError = e instanceof Error ? e.message : lastError;
    }
  }

  return {
    configured: true,
    ok: false,
    bucket,
    endpoint: candidates[0] ?? null,
    error: lastError,
  };
}

async function probeKeycloakIssuer(issuer: string) {
  const url = `${issuer.replace(/\/$/, "")}/.well-known/openid-configuration`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } finally {
    clearTimeout(timer);
  }
}

async function checkKeycloak(): Promise<{
  configured: boolean;
  ok: boolean;
  issuer: string | null;
  error?: string;
}> {
  const candidates: string[] = [];
  try {
    candidates.push(getKeycloakInternalIssuer());
  } catch {
    /* ignore */
  }
  if (process.env.KEYCLOAK_ISSUER) candidates.push(process.env.KEYCLOAK_ISSUER);
  if (process.env.NEXT_PUBLIC_KEYCLOAK_ISSUER) {
    candidates.push(process.env.NEXT_PUBLIC_KEYCLOAK_ISSUER);
  }

  const issuers = [...new Set(candidates.map((i) => i.replace(/\/$/, "")))];
  if (issuers.length === 0) {
    return { configured: false, ok: false, issuer: null };
  }

  let lastError = "Unreachable";
  for (const issuer of issuers) {
    try {
      await probeKeycloakIssuer(issuer);
      return { configured: true, ok: true, issuer };
    } catch (e) {
      lastError = e instanceof Error ? e.message : lastError;
    }
  }

  return {
    configured: true,
    ok: false,
    issuer: issuers[0] ?? null,
    error: lastError,
  };
}

function buildConfigChecks(): ConfigCheck[] {
  const managementUrl = process.env.MANAGEMENT_PUBLIC_URL ?? null;
  const authSecret = process.env.AUTH_SECRET ?? null;
  const checks: Array<{
    key: string;
    label: string;
    value: string | null;
    required?: boolean;
    hint?: string;
  }> = [
    {
      key: "MANAGEMENT_PUBLIC_URL",
      label: "Management public URL",
      value: managementUrl,
      required: true,
      hint: "Used for QR codes on diplomas and transcripts",
    },
    {
      key: "AUTH_SECRET",
      label: "Auth secret",
      value: authSecret ? "••••••••" : null,
      required: true,
    },
    {
      key: "DATABASE_URL",
      label: "Database URL",
      value: process.env.DATABASE_URL ? "(set)" : null,
      required: true,
    },
    {
      key: "KEYCLOAK_ISSUER",
      label: "Keycloak issuer",
      value:
        process.env.KEYCLOAK_ISSUER ??
        process.env.NEXT_PUBLIC_KEYCLOAK_ISSUER ??
        null,
      required: true,
    },
    {
      key: "MINIO_ENDPOINT",
      label: "MinIO endpoint",
      value: process.env.MINIO_ENDPOINT ?? null,
      hint: "Required for published diploma PDF storage",
    },
    {
      key: "SMTP_HOST",
      label: "SMTP host",
      value: process.env.SMTP_HOST ?? null,
      hint: "Invitation and notification emails",
    },
    {
      key: "WIDGET_PUBLIC_URL",
      label: "Verify widget URL",
      value: process.env.WIDGET_PUBLIC_URL ?? null,
    },
    {
      key: "TYPO3_BASE_URL",
      label: "TYPO3 site URL",
      value: process.env.TYPO3_BASE_URL ?? null,
    },
  ];

  return checks.map((c) => ({
    key: c.key,
    label: c.label,
    value: c.value,
    hint: c.hint,
    status: (c.value
      ? "ok"
      : c.required
        ? "missing"
        : "optional") satisfies ConfigCheckStatus,
  }));
}

function computeOverall(
  database: { ok: boolean; error?: string },
  config: ConfigCheck[],
  storage: { configured: boolean; ok: boolean; endpoint: string | null; error?: string },
  keycloak: { configured: boolean; ok: boolean; issuer: string | null; error?: string }
): { overall: DiagnosticsPayload["overall"]; issues: string[] } {
  const issues: string[] = [];

  if (!database.ok) {
    issues.push(
      `Database unreachable${database.error ? `: ${database.error}` : ""}`
    );
    return { overall: "unhealthy", issues };
  }

  for (const c of config) {
    if (c.status === "missing") {
      issues.push(`Missing required configuration: ${c.key}`);
    }
  }

  if (storage.configured && !storage.ok) {
    issues.push(
      `Object storage (MinIO) not reachable at ${storage.endpoint ?? "configured endpoint"}${storage.error ? ` — ${storage.error}` : ""}. If the app runs on the host, use http://localhost:9000 instead of http://minio:9000.`
    );
  }

  if (keycloak.configured && !keycloak.ok) {
    issues.push(
      `Keycloak OIDC discovery failed${keycloak.issuer ? ` (${keycloak.issuer})` : ""}${keycloak.error ? ` — ${keycloak.error}` : ""}. If the app runs on the host, ensure KEYCLOAK_INTERNAL_ISSUER or KEYCLOAK_ISSUER points to http://localhost:8080/realms/renis.`
    );
  }

  if (issues.length > 0) {
    return { overall: "degraded", issues };
  }

  return { overall: "healthy", issues: [] };
}

export async function gatherSystemDiagnostics(): Promise<DiagnosticsPayload> {
  const [database, storage, keycloak] = await Promise.all([
    checkDatabase(),
    checkMinio(),
    checkKeycloak(),
  ]);

  const config = buildConfigChecks();
  const managementPublic =
    process.env.MANAGEMENT_PUBLIC_URL?.replace(/\/$/, "") ?? null;

  const [
    institutions,
    institutionsActive,
    users,
    students,
    programmes,
    subjects,
    gradeSessions,
    grades,
    diplomas,
    enrollments,
    transcriptRecords,
    auditLogs,
    diplomaGroups,
    sessionGroups,
    userGroups,
    lastAudit,
    lastSubmittedSession,
    auditLast24h,
    topAuditRaw,
  ] = await Promise.all([
    prisma.institution.count(),
    prisma.institution.count({ where: { active: true } }),
    prisma.user.count(),
    prisma.student.count({ where: { active: true } }),
    prisma.programme.count({ where: { active: true } }),
    prisma.subject.count(),
    prisma.gradeSession.count(),
    prisma.grade.count(),
    prisma.diploma.count(),
    prisma.programmeEnrollment.count({ where: { active: true } }),
    prisma.transcriptRecord.count(),
    prisma.auditLog.count(),
    prisma.diploma.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.gradeSession.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.user.groupBy({ by: ["role"], _count: { _all: true } }),
    prisma.auditLog.findFirst({
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, action: true },
    }),
    prisma.gradeSession.findFirst({
      where: { status: GradeStatus.SUBMITTED },
      orderBy: { submittedAt: "desc" },
      select: { submittedAt: true },
    }),
    prisma.auditLog.count({
      where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    }),
    prisma.auditLog.groupBy({
      by: ["action"],
      _count: { _all: true },
    }),
  ]);

  const diplomasByStatus: Record<string, number> = {};
  for (const row of diplomaGroups) {
    diplomasByStatus[row.status] = row._count._all;
  }
  for (const s of Object.values(DiplomaStatus)) {
    if (!(s in diplomasByStatus)) diplomasByStatus[s] = 0;
  }

  const gradeSessionsByStatus: Record<string, number> = {};
  for (const row of sessionGroups) {
    gradeSessionsByStatus[row.status] = row._count._all;
  }
  for (const s of Object.values(GradeStatus)) {
    if (!(s in gradeSessionsByStatus)) gradeSessionsByStatus[s] = 0;
  }

  const usersByRole: Record<string, number> = {};
  for (const row of userGroups) {
    usersByRole[row.role] = row._count._all;
  }
  for (const r of Object.values(UserRole)) {
    if (!(r in usersByRole)) usersByRole[r] = 0;
  }

  const { overall, issues } = computeOverall(database, config, storage, keycloak);

  const payload: DiagnosticsPayload = {
    checkedAt: new Date().toISOString(),
    version: process.env.npm_package_version ?? "0.1.0",
    environment: process.env.NODE_ENV ?? "development",
    overall,
    issues,
    database,
    storage,
    keycloak,
    config,
    counts: {
      institutions,
      institutionsActive,
      institutionsInactive: institutions - institutionsActive,
      users,
      students,
      programmes,
      subjects,
      gradeSessions,
      grades,
      diplomas,
      enrollments,
      transcriptRecords,
      auditLogs,
    },
    breakdown: {
      diplomasByStatus,
      gradeSessionsByStatus,
      usersByRole,
    },
    activity: {
      lastAuditAt: lastAudit?.createdAt.toISOString() ?? null,
      lastAuditAction: lastAudit?.action ?? null,
      lastSubmittedGradeSessionAt:
        lastSubmittedSession?.submittedAt?.toISOString() ?? null,
      auditLast24h,
      topAuditActions: [...topAuditRaw]
        .sort((a, b) => b._count._all - a._count._all)
        .slice(0, 8)
        .map((r) => ({
          action: r.action,
          count: r._count._all,
        })),
    },
    services: {
      managementPublicUrl: managementPublic,
      qrVerifyBaseUrl: managementPublic ? `${managementPublic}/verify` : null,
      keycloakIssuer:
        process.env.KEYCLOAK_ISSUER ??
        process.env.NEXT_PUBLIC_KEYCLOAK_ISSUER ??
        null,
      keycloakAdminUrl: process.env.KEYCLOAK_ADMIN_URL ?? null,
      widgetPublicUrl: process.env.WIDGET_PUBLIC_URL ?? null,
      typo3BaseUrl: process.env.TYPO3_BASE_URL ?? null,
      minioEndpoint: process.env.MINIO_ENDPOINT ?? null,
      minioPublicUrl: process.env.MINIO_PUBLIC_URL ?? null,
      smtpHost: process.env.SMTP_HOST ?? null,
    },
  };

  return payload;
}
