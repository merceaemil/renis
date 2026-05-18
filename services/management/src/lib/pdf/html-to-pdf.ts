function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export { escapeHtml };

export async function htmlToPdf(html: string): Promise<Buffer> {
  const puppeteer = await import("puppeteer-core");

  let executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  let args = ["--no-sandbox", "--disable-setuid-sandbox"];

  if (!executablePath) {
    try {
      const chromium = await import("@sparticuz/chromium");
      executablePath = await chromium.default.executablePath();
      args = chromium.default.args;
    } catch {
      // Local dev: install chromium or set PUPPETEER_EXECUTABLE_PATH
    }
  }

  if (!executablePath) {
    throw new Error(
      "PDF generation unavailable: set PUPPETEER_EXECUTABLE_PATH or use Docker image with Chromium."
    );
  }

  const browser = await puppeteer.default.launch({
    executablePath,
    args,
    headless: true,
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "20mm", bottom: "20mm", left: "15mm", right: "15mm" },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
