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

/**
 * Extract social media links from raw content using regex BEFORE truncation.
 * This ensures footer links aren't lost when content is truncated.
 */
function extractSocialLinksFromRaw(content: string): {
  youtube: string | null;
  reddit: string | null;
  twitter: string | null;
  linkedin: string | null;
  instagram: string | null;
} {
  const links = {
    youtube: null as string | null,
    reddit: null as string | null,
    twitter: null as string | null,
    linkedin: null as string | null,
    instagram: null as string | null,
  };

  // YouTube — match channel URLs
  const ytMatch = content.match(/https?:\/\/(?:www\.)?youtube\.com\/(?:channel\/[a-zA-Z0-9_\-]+|@[a-zA-Z0-9_\-]+|c\/[a-zA-Z0-9_\-]+|user\/[a-zA-Z0-9_\-]+)/i);
  if (ytMatch) links.youtube = ytMatch[0];

  // Reddit — match subreddit URLs
  const rdMatch = content.match(/https?:\/\/(?:www\.)?reddit\.com\/r\/[a-zA-Z0-9_\-]+/i);
  if (rdMatch) links.reddit = rdMatch[0];

  // Twitter/X — match profile URLs (exclude tracking pixels)
  const twMatches = content.matchAll(/https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]+)/gi);
  for (const m of twMatches) {
    const handle = m[1];
    // Skip tracking endpoints and generic paths
    if (!["i", "intent", "widgets", "1"].includes(handle.toLowerCase())) {
      links.twitter = m[0];
      break;
    }
  }

  // LinkedIn — match company URLs
  const liMatch = content.match(/https?:\/\/(?:www\.)?linkedin\.com\/company\/[a-zA-Z0-9_\-]+/i);
  if (liMatch) links.linkedin = liMatch[0];

  // Instagram — match profile URLs
  const igMatch = content.match(/https?:\/\/(?:www\.)?instagram\.com\/[a-zA-Z0-9_.]+/i);
  if (igMatch) links.instagram = igMatch[0];

  return links;
}

/**
 * Clean markdown content by removing image URLs and tracking pixels
 * to maximize useful text within the truncation limit.
 */
function cleanMarkdownForLLM(content: string): string {
  let cleaned = content;
  // Remove markdown image syntax with long URLs: ![alt](url)
  cleaned = cleaned.replace(/!\[([^\]]*)\]\([^)]+\)/g, "[Image: $1]");
  // Remove bare long URLs (tracking pixels, CDN URLs) that are > 100 chars
  cleaned = cleaned.replace(/https?:\/\/[^\s)\]]{100,}/g, "[long-url-removed]");
  // Compress multiple blank lines
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n");
  return cleaned;
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

  console.log(`[websiteAnalyzer] Raw scraped content: ${combinedContent.length} chars`);

  // Step 1: Extract social links from FULL raw content BEFORE truncation
  const rawSocialLinks = extractSocialLinksFromRaw(combinedContent);
  console.log(`[websiteAnalyzer] Pre-truncation social links extracted:`, JSON.stringify(rawSocialLinks));

  // Step 2: Clean content (remove image URLs, tracking pixels) to maximize useful text
  const cleaned = cleanMarkdownForLLM(combinedContent);
  console.log(`[websiteAnalyzer] Cleaned content: ${cleaned.length} chars (saved ${combinedContent.length - cleaned.length} chars)`);

  // Step 3: Truncate cleaned content
  const truncated = truncateContent(cleaned, 15000);

  // Step 4: Include pre-extracted social links in the prompt so Groq has them
  const socialLinksHint = `\n\n--- SOCIAL LINKS FOUND IN PAGE ---\n${JSON.stringify(rawSocialLinks, null, 2)}\n`;

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

IMPORTANT: For socialLinks, I've pre-extracted links from the full page below. Use them directly. 
For brandHandle, derive it from the Twitter/YouTube handle if available (e.g. if Twitter is twitter.com/NotionHQ, brandHandle should be "NotionHQ").

Return only valid JSON, no markdown.
${socialLinksHint}
Website Content:
${truncated}`;

  const websiteData = await runGroqPrompt<WebsiteData>(prompt, 0.3);
  
  // Merge: if Groq returned null links but we extracted them from raw, use raw
  if (websiteData.socialLinks && rawSocialLinks) {
    if (!websiteData.socialLinks.youtube && rawSocialLinks.youtube) websiteData.socialLinks.youtube = rawSocialLinks.youtube;
    if (!websiteData.socialLinks.reddit && rawSocialLinks.reddit) websiteData.socialLinks.reddit = rawSocialLinks.reddit;
    if (!websiteData.socialLinks.twitter && rawSocialLinks.twitter) websiteData.socialLinks.twitter = rawSocialLinks.twitter;
    if (!websiteData.socialLinks.linkedin && rawSocialLinks.linkedin) websiteData.socialLinks.linkedin = rawSocialLinks.linkedin;
    if (!websiteData.socialLinks.instagram && rawSocialLinks.instagram) websiteData.socialLinks.instagram = rawSocialLinks.instagram;
  }

  console.log(`[websiteAnalyzer] Successfully analyzed website for ${websiteData.companyName}`);
  console.log(`[websiteAnalyzer] Final social links:`, JSON.stringify(websiteData.socialLinks));
  console.log(`[websiteAnalyzer] brandHandle: "${websiteData.brandHandle}"`);
  return websiteData;
}
