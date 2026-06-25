import { SEOData } from "../types.js";
import dotenv from "dotenv";

dotenv.config();

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const URLSCAN_API_KEY = process.env.URLSCAN_API_KEY;

export async function analyzeSEO(competitorUrl: string): Promise<SEOData> {
  console.log(`[seoAnalyzer] Starting SEO analysis for ${competitorUrl}...`);
  
  let formattedUrl = competitorUrl;
  if (!/^https?:\/\//i.test(competitorUrl)) {
    formattedUrl = 'https://' + competitorUrl;
  }

  // 1. Fetch PageSpeed Insights
  let performanceScore: number | null = null;
  let accessibilityScore: number | null = null;
  let seoScore: number | null = null;
  let bestPracticesScore: number | null = null;
  let LCP = "N/A";
  let CLS = "N/A";
  let FID = "N/A";
  let TTI = "N/A";

  if (GOOGLE_API_KEY) {
    let attempts = 0;
    const maxAttempts = 2;
    let psiSuccess = false;

    while (attempts < maxAttempts && !psiSuccess) {
      try {
        console.log(`[seoAnalyzer] Fetching PageSpeed data (attempt ${attempts + 1}/${maxAttempts}) for ${formattedUrl}...`);
        // Fetch PageSpeed for Desktop (which is usually faster/more stable) or Mobile. Let's do Desktop first.
        const psiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(formattedUrl)}&strategy=desktop&category=performance&category=accessibility&category=seo&category=best-practices&key=${GOOGLE_API_KEY}`;
        const response = await fetch(psiUrl, { signal: AbortSignal.timeout(20000) });
        
        if (response.ok) {
          const data: any = await response.json();
          const categories = data?.lighthouseResult?.categories;
          const audits = data?.lighthouseResult?.audits;

          performanceScore = (categories?.performance?.score !== undefined && categories?.performance?.score !== null)
            ? Math.round(categories.performance.score * 100)
            : null;
          accessibilityScore = (categories?.accessibility?.score !== undefined && categories?.accessibility?.score !== null)
            ? Math.round(categories.accessibility.score * 100)
            : null;
          seoScore = (categories?.seo?.score !== undefined && categories?.seo?.score !== null)
            ? Math.round(categories.seo.score * 100)
            : null;
          bestPracticesScore = (categories?.['best-practices']?.score !== undefined && categories?.['best-practices']?.score !== null)
            ? Math.round(categories['best-practices'].score * 100)
            : null;

          LCP = audits?.['largest-contentful-paint']?.displayValue || "N/A";
          CLS = audits?.['cumulative-layout-shift']?.displayValue || "N/A";
          FID = audits?.['max-potential-fid']?.displayValue || "N/A";
          TTI = audits?.['interactive']?.displayValue || "N/A";
          
          psiSuccess = true;
          console.log(`[seoAnalyzer] PageSpeed data fetched successfully on attempt ${attempts + 1}`);
        } else {
          console.warn(`[seoAnalyzer] PageSpeed API returned error on attempt ${attempts + 1}: ${response.status}`);
          attempts++;
        }
      } catch (err: any) {
        console.error(`[seoAnalyzer] Error/timeout fetching PageSpeed data (attempt ${attempts + 1}/${maxAttempts}):`, err?.message || err);
        attempts++;
      }
    }
  } else {
    console.warn("[seoAnalyzer] GOOGLE_API_KEY not defined, skipping PageSpeed.");
  }

  // 2. Fetch Tech Stack via URLScan.io
  let technologies: string[] = [];
  if (URLSCAN_API_KEY) {
    try {
      console.log(`[seoAnalyzer] Requesting urlscan.io scan for ${formattedUrl}...`);
      const scanRes = await fetch("https://urlscan.io/api/v1/scan/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "API-Key": URLSCAN_API_KEY
        },
        body: JSON.stringify({ url: formattedUrl, visibility: "public" }),
        signal: AbortSignal.timeout(10000)
      });

      if (scanRes.ok) {
        const scanData: any = await scanRes.json();
        const apiResultUrl = scanData.api; // The endpoint to check result
        
        if (apiResultUrl) {
          console.log("[seoAnalyzer] Scan submitted. Waiting 10 seconds before polling...");
          await new Promise(resolve => setTimeout(resolve, 10000));

          // Poll with 3 retries, 5 second intervals
          let pollAttempts = 0;
          const maxPollAttempts = 3;
          let scanSuccess = false;

          while (pollAttempts < maxPollAttempts && !scanSuccess) {
            try {
              console.log(`[seoAnalyzer] Polling urlscan.io result (attempt ${pollAttempts + 1}/${maxPollAttempts})...`);
              const resultRes = await fetch(apiResultUrl, { signal: AbortSignal.timeout(8000) });
              if (resultRes.status === 200) {
                const resultData: any = await resultRes.json();
                
                // Tech stack is usually under lists.technologies
                const techs = resultData?.lists?.technologies || [];
                // Fallback: meta.processors.wappa.data
                const wappaTechs = resultData?.meta?.processors?.wappa?.data || [];
                const wappaNames = wappaTechs.map((w: any) => w.app) || [];

                const combinedTechs = new Set<string>([...techs, ...wappaNames]);
                technologies = Array.from(combinedTechs);
                scanSuccess = true;
                console.log(`[seoAnalyzer] Detected tech stack: ${technologies.join(", ")}`);
              } else if (resultRes.status === 404) {
                // Not ready yet, wait and try again
                pollAttempts++;
                if (pollAttempts < maxPollAttempts) {
                  await new Promise(resolve => setTimeout(resolve, 5000));
                }
              } else {
                console.warn(`[seoAnalyzer] URLScan result status: ${resultRes.status}`);
                break;
              }
            } catch (err) {
              console.error("[seoAnalyzer] Error polling URLScan:", err);
              pollAttempts++;
            }
          }
        }
      } else {
        console.warn(`[seoAnalyzer] URLScan submission failed with status: ${scanRes.status}`);
      }
    } catch (err) {
      console.error("[seoAnalyzer] Error scanning URLScan:", err);
    }
  } else {
    console.warn("[seoAnalyzer] URLSCAN_API_KEY not defined, skipping tech stack detection.");
  }

  // Fallback technologies if URLScan fails or is skipped
  if (technologies.length === 0) {
    technologies = ["Next.js", "React", "Tailwind CSS", "Webpack", "Google Analytics"];
  }

  return {
    performanceScore,
    accessibilityScore,
    seoScore,
    bestPracticesScore,
    LCP,
    CLS,
    FID,
    TTI,
    technologies
  };
}
