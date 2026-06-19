import { scrapeUrl, truncateContent } from "../lib/jina.js";
import { runGroqPrompt } from "../lib/groq.js";
import { ContentData } from "../types.js";

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

export async function analyzeContent(competitorUrl: string): Promise<ContentData> {
  console.log(`[contentAnalyzer] Starting blog analysis for ${competitorUrl}...`);
  const blogUrl = resolveSubUrl(competitorUrl, "/blog");
  
  let content = "";
  try {
    content = await scrapeUrl(blogUrl);
  } catch (error) {
    try {
      const resourcesUrl = resolveSubUrl(competitorUrl, "/resources");
      console.warn(`[contentAnalyzer] /blog failed. Trying /resources...`);
      content = await scrapeUrl(resourcesUrl);
    } catch {
      console.warn(`[contentAnalyzer] /resources failed too. Falling back to homepage scan.`);
      content = await scrapeUrl(competitorUrl);
    }
  }

  const truncated = truncateContent(content, 8000);

  const prompt = `Analyze this blog/content page and return JSON:
{
  "hasActiveBlog": boolean,
  "postingFrequency": "string",
  "mainTopics": ["string"],
  "contentStrategy": "string (2-3 sentence summary)",
  "estimatedLastPost": "string"
}

Return only valid JSON, no markdown.

Content:
${truncated}`;

  const contentData = await runGroqPrompt<ContentData>(prompt, 0.3);
  console.log(`[contentAnalyzer] Blog analysis complete. Has active blog: ${contentData.hasActiveBlog}`);
  return contentData;
}
