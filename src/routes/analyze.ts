import { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";
import os from "os";

import { analyzeWebsite } from "../agents/websiteAnalyzer";
import { extractPricing } from "../agents/pricingExtractor";
import { analyzeSEO } from "../agents/seoAnalyzer";
import { discoverSocialMedia } from "../agents/socialDiscoverer";
import { analyzeContent } from "../agents/contentAnalyzer";
import { synthesizeSWOT } from "../agents/swotSynthesizer";
import { generatePdfBuffer } from "../lib/pdf/generator";
import { CompetitorReport } from "../types";

const router = Router();

// Support both GET and POST to handle native EventSource (GET) and custom fetch calls
const handleAnalyze = async (req: Request, res: Response) => {
  const competitorUrl = (req.query.url as string) || (req.body.url as string);

  if (!competitorUrl) {
    return res.status(400).json({ error: "Missing competitor URL" });
  }

  // Set up SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // Prevent Nginx buffering
  res.flushHeaders();

  const reportId = uuidv4();
  const sendProgress = (step: string, status: string, label: string, extra = {}) => {
    res.write(`data: ${JSON.stringify({ step, status, label, ...extra })}\n\n`);
  };

  console.log(`[routes/analyze] Starting research orchestrator for: ${competitorUrl} (ID: ${reportId})`);
  sendProgress("scraping", "pending", "Scraping website homepage...");

  // Set up Promises for parallel execution
  // Website Analyzer runs first so Social Discoverer can consume its output
  const websitePromise = analyzeWebsite(competitorUrl);

  const pricingPromise = extractPricing(competitorUrl);
  const seoPromise = analyzeSEO(competitorUrl);
  const contentPromise = analyzeContent(competitorUrl);

  const socialPromise = (async () => {
    try {
      const websiteData = await websitePromise;
      return await discoverSocialMedia(websiteData.brandHandle, websiteData.socialLinks);
    } catch (err) {
      console.warn(`[routes/analyze] websiteAnalyzer failed before socialDiscoverer. Extracting handle from URL.`, err);
      // Fallback: extract handle from URL
      const cleanUrl = competitorUrl.replace(/https?:\/\/(?:www\.)?/, "");
      const brandHandle = cleanUrl.split(".")[0] || "competitor";
      return await discoverSocialMedia(brandHandle);
    }
  })();

  // Track completion of individual steps
  let websiteData: any = undefined;
  let pricingData: any = undefined;
  let seoData: any = undefined;
  let socialData: any = undefined;
  let contentData: any = undefined;

  const wrappedWebsite = (async () => {
    try {
      websiteData = await websitePromise;
      sendProgress("scraping", "complete", "Website scraped", { detail: `Company: ${websiteData.companyName}` });
    } catch (err: any) {
      console.error("[routes/analyze] websiteAnalyzer failed:", err);
      sendProgress("scraping", "failed", "Website scraping failed (Data unavailable)");
    }
  })();

  const wrappedPricing = (async () => {
    try {
      pricingData = await pricingPromise;
      const plansCount = pricingData.plans?.length || 0;
      sendProgress("pricing", "complete", "Pricing extracted", {
        detail: pricingData.hasPricing ? `Found ${plansCount} pricing plans` : "Contact sales / No public pricing"
      });
    } catch (err: any) {
      console.error("[routes/analyze] pricingExtractor failed:", err);
      sendProgress("pricing", "failed", "Pricing extraction failed (Data unavailable)");
    }
  })();

  const wrappedSeo = (async () => {
    try {
      seoData = await seoPromise;
      sendProgress("seo", "complete", "SEO analyzed", { detail: `Performance Score: ${seoData.performanceScore}/100` });
    } catch (err: any) {
      console.error("[routes/analyze] seoAnalyzer failed:", err);
      sendProgress("seo", "failed", "SEO analysis failed (Data unavailable)");
    }
  })();

  const wrappedSocial = (async () => {
    try {
      socialData = await socialPromise;
      const ytSub = socialData.youtube?.channelFound ? `YouTube: ${socialData.youtube.subscriberCount} subs` : "";
      const redditSub = socialData.reddit?.subredditFound ? `Reddit: ${socialData.reddit.subscribers} members` : "";
      const details = [ytSub, redditSub].filter(Boolean).join(", ") || "No major social channels found";
      sendProgress("social", "complete", "Social media found", { detail: details });
    } catch (err: any) {
      console.error("[routes/analyze] socialDiscoverer failed:", err);
      sendProgress("social", "failed", "Social discovery failed (Data unavailable)");
    }
  })();

  const wrappedContent = (async () => {
    try {
      contentData = await contentPromise;
      sendProgress("content", "complete", "Content strategy analyzed", {
        detail: contentData.hasActiveBlog ? `Blog active: ${contentData.postingFrequency}` : "No active blog found"
      });
    } catch (err: any) {
      console.error("[routes/analyze] contentAnalyzer failed:", err);
      sendProgress("content", "failed", "Content strategy analysis failed (Data unavailable)");
    }
  })();

  // Run all 5 sub-agents in parallel
  await Promise.allSettled([
    wrappedWebsite,
    wrappedPricing,
    wrappedSeo,
    wrappedSocial,
    wrappedContent
  ]);

  // SWOT Report step
  sendProgress("swot", "pending", "Generating SWOT report...");
  let swotData: any = undefined;
  try {
    swotData = await synthesizeSWOT(websiteData, pricingData, seoData, socialData, contentData);
    sendProgress("swot", "complete", "SWOT generated", { detail: "Analysis complete" });
  } catch (err: any) {
    console.error("[routes/analyze] swotSynthesizer failed:", err);
    sendProgress("swot", "failed", "SWOT generation failed (Data unavailable)");
  }

  // PDF generation step
  sendProgress("pdf", "pending", "Building PDF...");
  try {
    const report: CompetitorReport = {
      id: reportId,
      url: competitorUrl,
      createdAt: new Date().toISOString(),
      websiteData,
      pricingData,
      seoData,
      socialData,
      contentData,
      swotData
    };

    const pdfBuffer = await generatePdfBuffer(report);

    // Save PDF in temporary folder
    const tempDir = os.tmpdir();
    const filePath = path.join(tempDir, `${reportId}.pdf`);
    fs.writeFileSync(filePath, pdfBuffer);
    console.log(`[routes/analyze] PDF saved to temporary location: ${filePath}`);

    sendProgress("pdf", "complete", "PDF ready", { downloadUrl: `/download/${reportId}` });
  } catch (err: any) {
    console.error("[routes/analyze] PDF generation failed:", err);
    sendProgress("pdf", "failed", "PDF generation failed");
  }

  res.write("event: end\ndata: {}\n\n");
  res.end();
};

router.get("/", handleAnalyze);
router.post("/", handleAnalyze);

export default router;
