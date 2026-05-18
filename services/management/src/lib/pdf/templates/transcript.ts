import { escapeHtml } from "../html-to-pdf";

export type TranscriptPdfData = {
  institutionName: string;
  programmeName: string;
  academicYear: string;
  semester: string;
  studentName: string;
  studentIdNumber: string;
  subjects: { code: string; name: string; grade: string; coefficient: number }[];
  semesterAverage: string;
  classification: string | null;
  verifyUrl: string;
  qrDataUrl: string;
  generatedAt: string;
  institutionLogoUrl?: string | null;
};

export function renderTranscriptHtml(data: TranscriptPdfData): string {
  const rows = data.subjects
    .map(
      (s) => `
      <tr>
        <td>${escapeHtml(s.code)}</td>
        <td>${escapeHtml(s.name)}</td>
        <td style="text-align:right">${escapeHtml(s.grade)}</td>
        <td style="text-align:right">${s.coefficient}</td>
      </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: Georgia, serif; color: #0f172a; font-size: 11pt; }
    .header { display: flex; justify-content: flex-end; margin-bottom: 12px; }
    .header img { max-height: 56px; max-width: 120px; object-fit: contain; }
    h1 { font-size: 16pt; margin: 0 0 4px; }
    .meta { color: #475569; font-size: 10pt; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; }
    th { background: #f1f5f9; font-size: 9pt; }
    .footer { margin-top: 24px; display: flex; gap: 16px; align-items: flex-start; font-size: 9pt; color: #475569; }
    .avg { font-weight: bold; margin: 12px 0; }
    img { width: 80px; height: 80px; }
  </style>
</head>
<body>
  ${
    data.institutionLogoUrl
      ? `<div class="header"><img src="${data.institutionLogoUrl}" alt="Institution logo" /></div>`
      : ""
  }
  <h1>Official academic transcript</h1>
  <p class="meta">${escapeHtml(data.institutionName)} · ${escapeHtml(data.programmeName)}<br/>
  ${escapeHtml(data.academicYear)} · Semester ${escapeHtml(data.semester)}</p>
  <p><strong>${escapeHtml(data.studentName)}</strong> (${escapeHtml(data.studentIdNumber)})</p>
  <table>
    <thead><tr><th>Code</th><th>Subject</th><th>Grade</th><th>Coef.</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <p class="avg">Semester average: ${escapeHtml(data.semesterAverage)}${
    data.classification
      ? ` · Classification: <strong>${escapeHtml(data.classification)}</strong>`
      : ""
  }</p>
  <div class="footer">
    <img src="${data.qrDataUrl}" alt="QR" />
    <div>
      <p>RENIS-BI verification reference</p>
      <p>${escapeHtml(data.verifyUrl)}</p>
      <p>Generated ${escapeHtml(data.generatedAt)}</p>
    </div>
  </div>
</body>
</html>`;
}
