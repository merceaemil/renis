import { escapeHtml } from "../html-to-pdf";

export type DiplomaPdfData = {
  institutionName: string;
  studentName: string;
  diplomaType: string;
  title: string;
  graduationYear: number;
  honors: string | null;
  uniqueCode: string;
  verifyUrl: string;
  qrDataUrl: string;
  publishedAt: string;
  preview?: boolean;
  institutionLogoUrl?: string | null;
  ministryLogoUrl?: string | null;
  institutionSignatureUrl?: string | null;
  ministrySignatureUrl?: string | null;
};

/** Header logos only when uploaded/configured — no dashed placeholder box. */
function headerLogo(url: string | null | undefined, alt: string): string {
  if (!url) return "";
  return `<img src="${url}" alt="${escapeHtml(alt)}" class="brand-img" />`;
}

function sigImage(
  url: string | null | undefined,
  alt: string,
  label: string
): string {
  if (url) {
    return `<img src="${url}" alt="${escapeHtml(alt)}" />`;
  }
  return `<div class="brand-placeholder">${escapeHtml(label)}</div>`;
}

export function renderDiplomaHtml(data: DiplomaPdfData): string {
  const previewBanner = data.preview
    ? `<p class="preview">DRAFT PREVIEW — NOT OFFICIAL</p>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: "Liberation Sans", Arial, sans-serif; text-align: center; color: #0f172a; padding: 28px 32px 40px; }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; min-height: 72px; gap: 16px; }
    .header-start { flex: 1; display: flex; justify-content: flex-start; align-items: center; min-width: 0; }
    .header-end { flex: 1; display: flex; justify-content: flex-end; align-items: center; min-width: 0; }
    .brand-img { max-height: 64px; max-width: 140px; object-fit: contain; }
    .brand-placeholder { font-size: 8pt; color: #94a3b8; border: 1px dashed #cbd5e1; padding: 12px 16px; border-radius: 4px; }
    .preview { background: #fef3c7; color: #92400e; padding: 8px; font-size: 10pt; font-weight: bold; margin-bottom: 16px; }
    .seal { font-size: 11pt; letter-spacing: 0.12em; color: #64748b; margin-bottom: 16px; }
    h1 { font-family: Georgia, serif; font-size: 20pt; margin: 0 0 6px; font-weight: normal; }
    h2 { font-family: Georgia, serif; font-size: 13pt; margin: 0 0 28px; color: #334155; font-weight: normal; }
    .name { font-family: Georgia, serif; font-size: 20pt; margin: 20px 0; font-weight: bold; }
    .meta { font-size: 11pt; color: #475569; margin: 6px 0; }
    .footer { margin-top: 36px; font-size: 9pt; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 16px; }
    .footer img.qr { width: 88px; height: 88px; margin-bottom: 8px; }
    .code { font-family: monospace; font-size: 9pt; }
    .signatures { display: flex; justify-content: space-around; margin-top: 40px; gap: 24px; }
    .sig { flex: 1; max-width: 200px; }
    .sig img { max-height: 48px; max-width: 160px; object-fit: contain; }
    .sig p { font-size: 9pt; margin-top: 8px; color: #475569; }
  </style>
</head>
<body>
  ${previewBanner}
  <div class="header">
    <div class="header-start">${headerLogo(data.ministryLogoUrl, "Ministry coat of arms")}</div>
    <div class="header-end">${headerLogo(data.institutionLogoUrl, "Institution logo")}</div>
  </div>
  <p class="seal">${escapeHtml(data.institutionName)}</p>
  <h1>Republic of Burundi</h1>
  <h2>Ministry of Higher Education — RENIS-BI</h2>
  <h2 style="font-size:12pt;margin-top:-20px;margin-bottom:24px">DIPLOMA OF ${escapeHtml(data.diplomaType.toUpperCase())}</h2>
  <p class="meta">This certifies that</p>
  <p class="name">${escapeHtml(data.studentName)}</p>
  <p class="meta">has been awarded</p>
  <p><strong>${escapeHtml(data.title)}</strong></p>
  ${data.honors ? `<p class="meta">With ${escapeHtml(data.honors)}</p>` : ""}
  <p class="meta">Graduation year: ${data.graduationYear}</p>
  <div class="signatures">
    <div class="sig">
      ${sigImage(data.institutionSignatureUrl, "Institution signature", "Institution signature")}
      <p>Institution representative</p>
    </div>
    <div class="sig">
      ${sigImage(data.ministrySignatureUrl, "Ministry signature", "Ministry representative")}
      <p>Ministry representative</p>
    </div>
  </div>
  <div class="footer">
    ${
      data.qrDataUrl
        ? `<img class="qr" src="${data.qrDataUrl}" alt="Verification QR" />
    <p>Verify at ${escapeHtml(data.verifyUrl)}</p>`
        : `<p class="meta" style="margin-bottom:12px">Verification QR and link will appear after the diploma is submitted and published.</p>`
    }
    <p class="code">Code: ${escapeHtml(data.uniqueCode)}</p>
    <p>Generated ${escapeHtml(data.publishedAt)}</p>
  </div>
</body>
</html>`;
}
