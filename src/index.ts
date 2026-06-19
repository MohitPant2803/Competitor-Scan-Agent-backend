import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import analyzeRouter from "./routes/analyze.js";
import pdfRouter from "./routes/pdf.js";
import downloadRouter from "./routes/download.js";

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors({
  origin: (origin, callback) => {
    // Allow any origin dynamically to prevent deploy/CORS issues
    callback(null, true);
  },
  methods: ["GET", "POST"],
  credentials: true
}));

app.use(express.json());

// Health check endpoint for Render keep-alive
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Register routes
app.use("/analyze", analyzeRouter);
app.use("/generate-pdf", pdfRouter);
app.use("/download", downloadRouter);

app.listen(port, () => {
  console.log(`[CompetitorScan Backend] Server running on port ${port}`);
});
