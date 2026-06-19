import { scrapeUrl, truncateContent } from "../lib/jina.js";
import { runGroqPrompt } from "../lib/groq.js";
import { PricingData } from "../types.js";

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

export async function extractPricing(competitorUrl: string): Promise<PricingData> {
  console.log(`[pricingExtractor] Starting pricing extraction for ${competitorUrl}...`);
  const pricingUrl = resolveSubUrl(competitorUrl, "/pricing");
  
  let content = "";
  try {
    content = await scrapeUrl(pricingUrl);
  } catch (error) {
    console.warn(`[pricingExtractor] Failed to scrape /pricing page. Falling back to homepage scan.`);
    // Fall back to main homepage if /pricing fails
    content = await scrapeUrl(competitorUrl);
  }

  const truncated = truncateContent(content, 4000);

  const prompt = `Extract pricing information from this content as JSON:
{
  "hasPricing": boolean,
  "pricingModel": "subscription" | "one-time" | "usage-based" | "freemium" | "contact-sales",
  "plans": [
    {
      "name": "string",
      "price": "string",
      "billingCycle": "monthly" | "yearly" | "one-time",
      "features": ["string"],
      "isPopular": boolean
    }
  ],
  "hasFreeTrialOrFreeTier": boolean,
  "notes": "string"
}

Return only valid JSON, no markdown.

Content:
${truncated}`;

  const pricingData = await runGroqPrompt<PricingData>(prompt, 0.3);
  console.log(`[pricingExtractor] Successfully extracted pricing. Plans found: ${pricingData.plans?.length || 0}`);
  return pricingData;
}
