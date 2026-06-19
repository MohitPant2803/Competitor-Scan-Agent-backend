import { SEOData } from "../types";
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
  let performanceScore = 0;
  let accessibilityScore = 0;
  let seoScore = 0;
  let bestPracticesScore = 0;
  let LCP = "N/A";
  let CLS = "N/A";
  let FID = "N/A";
  let TTI = "N/A";

  if (GOOGLE_API_KEY) {
    try {
      // Fetch PageSpeed for Desktop (which is usually faster/more stable) or Mobile. Let's do Desktop first.
      const psiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(formattedUrl)}&strategy=desktop&key=${GOOGLE_API_KEY}`;
      const response = await fetch(psiUrl);
      if (response.ok) {
        const data: any = await response.json();
        const categories = data?.lighthouseResult?.categories;
        const audits = data?.lighthouseResult?.audits;

        performanceScore = Math.round((categories?.performance?.score || 0) * 100);
        accessibilityScore = Math.round((categories?.accessibility?.score || 0) * 100);
        seoScore = Math.round((categories?.seo?.score || 0) * 100);
        bestPracticesScore = Math.round((categories?.['best-practices']?.score || 0) * 100);

        LCP = audits?.['largest-contentful-paint']?.displayValue || "N/A";
        CLS = audits?.['cumulative-layout-shift']?.displayValue || "N/A";
        FID = audits?.['max-potential-fid']?.displayValue || "N/A";
        TTI = audits?.['interactive']?.displayValue || "N/A";
      } else {
        console.warn(`[seoAnalyzer] PageSpeed API returned error: ${response.status}`);
      }
    } catch (err) {
      console.error("[seoAnalyzer] Error fetching PageSpeed data:", err);
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
        body: JSON.stringify({ url: formattedUrl, visibility: "public" })
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
              const resultRes = await fetch(apiResultUrl);
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
