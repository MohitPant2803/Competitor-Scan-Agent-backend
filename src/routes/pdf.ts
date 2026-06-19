import { Router, Request, Response } from "express";
import { generatePdfBuffer } from "../lib/pdf/generator";
import { CompetitorReport } from "../types";

const router = Router();

router.post("/", async (req: Request, res: Response) => {
  try {
    const report = req.body as CompetitorReport;
    if (!report || !report.url) {
      return res.status(400).json({ error: "Missing report data or URL" });
    }

    console.log(`[routes/pdf] Request received to generate PDF for ${report.url}`);
    const pdfBuffer = await generatePdfBuffer(report);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="competitorscan-${report.id || 'report'}.pdf"`);
    res.send(pdfBuffer);
  } catch (error: any) {
    console.error("[routes/pdf] Error generating PDF:", error);
    res.status(500).json({ error: "Failed to generate PDF", details: error?.message || error });
  }
});

export default router;
