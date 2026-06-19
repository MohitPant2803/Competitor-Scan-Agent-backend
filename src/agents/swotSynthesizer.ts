import { runGroqPrompt } from "../lib/groq.js";
import { truncateContent } from "../lib/jina.js";
import { SWOTData, WebsiteData, PricingData, SEOData, SocialData, ContentData } from "../types.js";

export async function synthesizeSWOT(
  websiteData?: WebsiteData,
  pricingData?: PricingData,
  seoData?: SEOData,
  socialData?: SocialData,
  contentData?: ContentData
): Promise<SWOTData> {
  console.log(`[swotSynthesizer] Synthesizing SWOT report...`);

  const companyStr = websiteData ? JSON.stringify(websiteData) : "Data unavailable";
  const pricingStr = pricingData ? JSON.stringify(pricingData) : "Data unavailable";
  const seoStr = seoData ? JSON.stringify(seoData) : "Data unavailable";
  const socialStr = socialData ? JSON.stringify(socialData) : "Data unavailable";
  const contentStr = contentData ? JSON.stringify(contentData) : "Data unavailable";

  const truncatedCompany = truncateContent(companyStr, 500);
  const truncatedPricing = truncateContent(pricingStr, 500);
  const truncatedSeo = truncateContent(seoStr, 500);
  const truncatedSocial = truncateContent(socialStr, 500);
  const truncatedContentData = truncateContent(contentStr, 500);

  const prompt = `You are a senior business analyst. Based on this competitor research data,
generate a detailed SWOT analysis from the perspective of a business owner 
competing against this company.

Data:
- Company: ${truncatedCompany}
- Pricing: ${truncatedPricing}  
- SEO Performance: ${truncatedSeo}
- Social Presence: ${truncatedSocial}
- Content Strategy: ${truncatedContentData}

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
