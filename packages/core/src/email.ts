import nodemailer from "nodemailer";
import { prisma, UserRole, UserStatus } from "@renis/database";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST ?? "localhost",
  port: Number(process.env.SMTP_PORT ?? 1025),
  secure: process.env.SMTP_SECURE === "true",
});

export async function sendAnomalyFlagEmail(params: {
  to: string[];
  institutionName: string;
  programmeName: string;
  academicYear: string;
  semester: string;
  message: string;
  managementUrl: string;
}) {
  if (params.to.length === 0) return;
  const from = process.env.SMTP_FROM ?? "noreply@renis.bi";
  await transporter.sendMail({
    from,
    to: params.to.join(", "),
    subject: `Ministry anomaly flag — ${params.institutionName}`,
    html: `
      <p>The Ministry has flagged an anomaly on a submitted grade session.</p>
      <ul>
        <li><strong>Institution:</strong> ${params.institutionName}</li>
        <li><strong>Programme:</strong> ${params.programmeName}</li>
        <li><strong>Year:</strong> ${params.academicYear}</li>
        <li><strong>Semester:</strong> ${params.semester}</li>
      </ul>
      <p><strong>Message:</strong></p>
      <p>${params.message.replace(/</g, "&lt;")}</p>
      <p><a href="${params.managementUrl}/institution/grades">Open grades in RENIS-BI</a></p>
    `,
  });
}

export async function sendDiplomaNotificationEmail(params: {
  to: string[];
  subject: string;
  html: string;
}) {
  if (params.to.length === 0) return;
  const from = process.env.SMTP_FROM ?? "noreply@renis.bi";
  await transporter.sendMail({
    from,
    to: params.to.join(", "),
    subject: params.subject,
    html: params.html,
  });
}

export async function notifyMinistryDiplomaEvent(params: {
  event: "submitted" | "published" | "revoked";
  institutionName: string;
  studentLabel: string;
  diplomaTitle: string;
  managementUrl: string;
  reason?: string;
}) {
  const admins = await prisma.user.findMany({
    where: { role: UserRole.MINISTRY_ADMIN, status: UserStatus.ACTIVE },
    select: { email: true },
  });
  const titles = {
    submitted: "Diploma submitted for information",
    published: "Diploma published",
    revoked: "Diploma revoked",
  };
  const body =
    params.event === "revoked"
      ? `<p>A diploma has been revoked.</p><p><strong>Reason:</strong> ${(params.reason ?? "").replace(/</g, "&lt;")}</p>`
      : `<p>A diploma has been ${params.event}.</p>`;
  await sendDiplomaNotificationEmail({
    to: admins.map((a) => a.email),
    subject: `${titles[params.event]} — ${params.institutionName}`,
    html: `
      ${body}
      <ul>
        <li><strong>Institution:</strong> ${params.institutionName}</li>
        <li><strong>Student:</strong> ${params.studentLabel}</li>
        <li><strong>Diploma:</strong> ${params.diplomaTitle}</li>
      </ul>
      <p><a href="${params.managementUrl}/ministry">Ministry overview</a></p>
    `,
  });
}

export async function sendDiplomaAnomalyFlagEmail(params: {
  to: string[];
  institutionName: string;
  studentLabel: string;
  diplomaTitle: string;
  message: string;
  managementUrl: string;
}) {
  if (params.to.length === 0) return;
  const from = process.env.SMTP_FROM ?? "noreply@renis.bi";
  await transporter.sendMail({
    from,
    to: params.to.join(", "),
    subject: `Ministry diploma flag — ${params.institutionName}`,
    html: `
      <p>The Ministry has flagged an anomaly on a diploma record.</p>
      <ul>
        <li><strong>Institution:</strong> ${params.institutionName}</li>
        <li><strong>Student:</strong> ${params.studentLabel}</li>
        <li><strong>Diploma:</strong> ${params.diplomaTitle}</li>
      </ul>
      <p><strong>Message:</strong></p>
      <p>${params.message.replace(/</g, "&lt;")}</p>
      <p><a href="${params.managementUrl}/institution/diplomas">Open diplomas in RENIS-BI</a></p>
    `,
  });
}

export async function sendGradeSubmissionEmail(params: {
  to: string[];
  institutionName: string;
  programmeName: string;
  academicYear: string;
  semester: string;
  managementUrl: string;
}) {
  if (params.to.length === 0) return;
  const from = process.env.SMTP_FROM ?? "noreply@renis.bi";
  await transporter.sendMail({
    from,
    to: params.to.join(", "),
    subject: `Grades submitted — ${params.institutionName}`,
    html: `
      <p>A grade session has been submitted for ministry review.</p>
      <ul>
        <li><strong>Institution:</strong> ${params.institutionName}</li>
        <li><strong>Programme:</strong> ${params.programmeName}</li>
        <li><strong>Year:</strong> ${params.academicYear}</li>
        <li><strong>Semester:</strong> ${params.semester}</li>
      </ul>
      <p><a href="${params.managementUrl}/ministry">Open ministry overview</a></p>
    `,
  });
}
