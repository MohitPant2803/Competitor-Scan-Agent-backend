export async function scrapeUrl(url: string): Promise<string> {
  // If url doesn't have protocol, default to https
  let formattedUrl = url;
  if (!/^https?:\/\//i.test(url)) {
    formattedUrl = 'https://' + url;
  }

  const target = `https://r.jina.ai/${formattedUrl}`;
  let attempts = 0;
  
  while (attempts < 2) {
    try {
      const response = await fetch(target, {
        headers: {
          'Accept': 'text/markdown',
        }
      });
      if (!response.ok) {
        throw new Error(`Jina Reader API returned status ${response.status}`);
      }
      const text = await response.text();
      if (text && text.trim().length > 0) {
        return text;
      }
      throw new Error("Jina returned empty content");
    } catch (error: any) {
      attempts++;
      if (attempts >= 2) {
        console.error(`Jina scrape failed for ${formattedUrl} after 2 attempts:`, error?.message || error);
        throw error;
      }
      console.warn(`Jina scrape empty/failed for ${formattedUrl}, retrying in 2 seconds...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  return "";
}
