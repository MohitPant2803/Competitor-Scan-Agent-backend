function stripHtml(html: string): string {
  // Strip script, style, and iframe tags with content
  let text = html.replace(/<(script|style|iframe)\b[^>]*>[\s\S]*?<\/\1>/gi, "");
  // Strip all other HTML tags
  text = text.replace(/<[^>]+>/g, " ");
  // Compress whitespaces
  text = text.replace(/\s+/g, " ").trim();
  return text;
}

export async function scrapeUrl(url: string): Promise<string> {
  let formattedUrl = url;
  if (!/^https?:\/\//i.test(url)) {
    formattedUrl = 'https://' + url;
  }

  const target = `https://r.jina.ai/${formattedUrl}`;
  let attempts = 0;
  
  while (attempts < 2) {
    try {
      console.log(`[jina] Attempting Jina reader scrape for: ${formattedUrl} (Attempt ${attempts + 1}/2)`);
      const response = await fetch(target, {
        headers: {
          'Accept': 'text/markdown',
          'X-Return-Format': 'markdown',
          'X-Timeout': '30'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Jina Reader API returned status ${response.status}`);
      }
      
      const text = await response.text();
      // If content is empty or contains block notifications
      if (text && text.trim().length > 0 && !text.includes("blocked by") && !text.includes("Cloudflare")) {
        return text;
      }
      throw new Error("Jina returned empty, blocked, or Cloudflare protected content");
    } catch (error: any) {
      attempts++;
      if (attempts >= 2) {
        console.warn(`[jina] Jina reader failed for ${formattedUrl}. Falling back to direct HTML fetch...`, error?.message || error);
        break;
      }
      console.warn(`[jina] Jina scrape issue: ${error?.message || error}. Retrying in 2 seconds...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  // FALLBACK: Direct fetch + HTML strip
  try {
    console.log(`[jina] Direct fetching ${formattedUrl}...`);
    const directResponse = await fetch(formattedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
      }
    });

    if (!directResponse.ok) {
      throw new Error(`Direct fetch status: ${directResponse.status}`);
    }

    const html = await directResponse.text();
    const cleanText = stripHtml(html);
    
    if (cleanText.length > 0) {
      console.log(`[jina] Direct fetch succeeded. Extracted ${cleanText.length} chars of raw text.`);
      return cleanText;
    }
    throw new Error("Extracted text from HTML is empty");
  } catch (fallbackError: any) {
    console.error(`[jina] Fallback fetch failed for ${formattedUrl}:`, fallbackError?.message || fallbackError);
    throw new Error(`Failed to scrape URL with Jina and fallback: ${fallbackError?.message || fallbackError}`);
  }
}
