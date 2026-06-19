import { scrapeUrl, truncateContent } from "../lib/jina.js";
import { runGroqPrompt } from "../lib/groq.js";
import { WebsiteData } from "../types.js";

function resolveSubUrl(baseUrl: string, path: string): string {
  let base = baseUrl;
  if (!/^https?:\/\//i.test(baseUrl)) {
    base = 'https://' + baseUrl;
  }
  try {
    const parsed = new URL(base);
    parsed.pathname = path;
    return parsed.toString();
  } catch {
    return `${base.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
  }
}

export async function analyzeWebsite(competitorUrl: string): Promise<WebsiteData> {
  console.log(`[websiteAnalyzer] Starting analysis for ${competitorUrl}...`);
  
  const urlsToScrape = [
    competitorUrl,
    resolveSubUrl(competitorUrl, "/about"),
    resolveSubUrl(competitorUrl, "/blog")
  ];

  const scrapeResults = await Promise.allSettled(
    urlsToScrape.map(url => scrapeUrl(url))
  );

  let combinedContent = "";
  scrapeResults.forEach((result, idx) => {
    if (result.status === "fulfilled" && result.value) {
      combinedContent += `\n--- CONTENT FROM ${urlsToScrape[idx]} ---\n${result.value}\n`;
    }
  });

  if (!combinedContent.trim()) {
    throw new Error("Failed to scrape any content from the website.");
  }

  const truncated = truncateContent(combinedContent, 12000);

  const prompt = `From this website content, extract the following as JSON:
{
  "companyName": "string",
  "description": "string (2-3 sentences what they do)",
  "targetAudience": "string",
  "mainFeatures": ["string"] (top 6 features),
  "uniqueSellingPoints": ["string"],
  "socialLinks": {
    "youtube": "string or null",
    "reddit": "string or null",
    "twitter": "string or null",
    "linkedin": "string or null",
    "instagram": "string or null"
  },
  "brandHandle": "string (likely username slug e.g. 'notion' or 'notionhq')"
}

Return only valid JSON, no markdown.

Website Content:
${truncated}`;

  const websiteData = await runGroqPrompt<WebsiteData>(prompt, 0.3);
  console.log(`[websiteAnalyzer] Successfully analyzed website for ${websiteData.companyName}`);
  console.log('Extracted social links:', websiteData.socialLinks);
  return websiteData;
}
