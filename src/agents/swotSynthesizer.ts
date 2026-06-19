import { runGroqPrompt } from "../lib/groq";
import { SWOTData, WebsiteData, PricingData, SEOData, SocialData, ContentData } from "../types";

export async function synthesizeSWOT(
  websiteData?: WebsiteData,
  pricingData?: PricingData,
  seoData?: SEOData,
  socialData?: SocialData,
  contentData?: ContentData
): Promise<SWOTData> {
  console.log(`[swotSynthesizer] Synthesizing SWOT report...`);

  const prompt = `You are a senior business analyst. Based on this competitor research data,
generate a detailed SWOT analysis from the perspective of a business owner 
competing against this company.

Data:
- Company: ${JSON.stringify(websiteData || "Data unavailable")}
- Pricing: ${JSON.stringify(pricingData || "Data unavailable")}  
- SEO Performance: ${JSON.stringify(seoData || "Data unavailable")}
- Social Presence: ${JSON.stringify(socialData || "Data unavailable")}
- Content Strategy: ${JSON.stringify(contentData || "Data unavailable")}

Return as JSON:
{
  "strengths": [{ "point": "string", "detail": "string" }],
  "weaknesses": [{ "point": "string", "detail": "string" }],
  "opportunities": [{ "point": "string", "detail": "string" }],
  "threats": [{ "point": "string", "detail": "string" }],
  "executiveSummary": "string (3-4 sentences overall assessment)",
  "strategicRecommendations": ["string"]
}

Constraints:
- Strengths: 4-5 items
- Weaknesses: 4-5 items
- Opportunities: 3-4 items
- Threats: 3-4 items
- Strategic Recommendations: Exactly 3 actionable recommendations for someone competing with them
- Be specific, use the actual data provided, never be generic.

Return only valid JSON, no markdown.`;

  // SWOT synthesizer uses temperature: 0.7
  const swotData = await runGroqPrompt<SWOTData>(prompt, 0.7);
  console.log(`[swotSynthesizer] SWOT synthesis completed.`);
  return swotData;
}
