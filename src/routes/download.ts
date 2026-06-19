import { Router, Request, Response } from "express";
import fs from "fs";
import path from "path";
import os from "os";

const router = Router();

router.get("/:id", (req: Request, res: Response) => {
  const reportId = req.params.id;
  
  // Validate UUID to prevent directory traversal
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(reportId)) {
    return res.status(400).json({ error: "Invalid report ID format" });
  }

  const tempDir = os.tmpdir();
  const filePath = path.join(tempDir, `${reportId}.pdf`);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "Report PDF not found or expired" });
  }

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="competitorscan-${reportId}.pdf"`);

  const fileStream = fs.createReadStream(filePath);
  fileStream.pipe(res);
});

export default router;
