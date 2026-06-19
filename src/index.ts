import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import analyzeRouter from "./routes/analyze.js";
import pdfRouter from "./routes/pdf.js";
import downloadRouter from "./routes/download.js";

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// CORS setup
const allowedOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  process.env.FRONTEND_URL
].filter(Boolean) as string[];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    // If FRONTEND_URL is set to *, allow everything
    if (process.env.FRONTEND_URL === "*" || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    // Default fallback: in development allow localhost
    if (origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:")) {
      return callback(null, true);
    }
    return callback(new Error(`Origin ${origin} not allowed by CORS`));
  },
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
