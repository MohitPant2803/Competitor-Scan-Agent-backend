import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import { getHtmlTemplate } from "./template.js";
import { CompetitorReport } from "../../types.js";

export async function generatePdfBuffer(report: CompetitorReport): Promise<Buffer> {
  console.log(`[pdfGenerator] Launching puppeteer-core for ${report.url}...`);
  const htmlContent = getHtmlTemplate(report);
  
  let execPath = await chromium.executablePath();
  let launchArgs = [
    ...chromium.args,
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--single-process'
  ];
  let isHeadless = chromium.headless;

  if (process.platform === "win32") {
    const fs = await import("fs");
    const os = await import("os");
    const possiblePaths = [
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Users\\" + os.userInfo().username + "\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe"
    ];
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        execPath = p;
        launchArgs = [];
        isHeadless = true;
        console.log(`[pdfGenerator] Found local Windows Chrome at: ${execPath}`);
        break;
      }
    }
  }

  const browser = await puppeteer.launch({
    args: launchArgs,
    executablePath: execPath,
    headless: isHeadless,
  });

  try {
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: "networkidle0" });
    
    console.log("[pdfGenerator] Generating PDF format A4...");
    const pdfUint8Array = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: "0mm", // Template already has cover page margins and section margins
        bottom: "0mm",
        left: "0mm",
        right: "0mm"
      }
    });

    return Buffer.from(pdfUint8Array);
  } finally {
    await browser.close();
    console.log("[pdfGenerator] Puppeteer browser closed.");
  }
}
