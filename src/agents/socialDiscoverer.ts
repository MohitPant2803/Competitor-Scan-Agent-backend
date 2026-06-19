import { SocialData } from "../types.js";
import { runGroqPrompt } from "../lib/groq.js";
import { truncateContent } from "../lib/jina.js";
import dotenv from "dotenv";

dotenv.config();

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const REDDIT_USER_AGENT = process.env.REDDIT_USER_AGENT || "CompetitorScan/1.0";

async function checkUrlExists(url: string): Promise<boolean> {
  const target = url.startsWith("http") ? url : `https://${url}`;
  try {
    const res = await fetch(target, { method: "HEAD" });
    return res.status >= 200 && res.status < 400;
  } catch {
    return false;
  }
}

/**
 * Search DuckDuckGo HTML for a specific site-scoped query.
 * Returns the first matching URL found, or null.
 */
async function searchDuckDuckGo(query: string): Promise<string | null> {
  try {
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    console.log(`[socialDiscoverer] DuckDuckGo search: ${query}`);
    const res = await fetch(searchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });
    if (!res.ok) return null;
    const html = await res.text();
    // DuckDuckGo HTML results contain URLs in href attributes with uddg redirect
    // Extract actual URLs from the page
    const urlMatches = html.matchAll(/href="(https?:\/\/[^"]+)"/g);
    for (const m of urlMatches) {
      const decoded = decodeURIComponent(m[1]);
      // Return the first result URL that isn't a DuckDuckGo internal link
      if (!decoded.includes("duckduckgo.com") && !decoded.includes("duck.com")) {
        return decoded;
      }
    }
    return null;
  } catch (err) {
    console.error("[socialDiscoverer] DuckDuckGo search error:", err);
    return null;
  }
}

/**
 * Search DuckDuckGo for the brand's YouTube channel URL.
 */
async function searchYouTubeChannel(brandName: string): Promise<string | null> {
  const result = await searchDuckDuckGo(`site:youtube.com ${brandName} official channel`);
  if (result && (result.includes("youtube.com/@") || result.includes("youtube.com/c/") || result.includes("youtube.com/channel/") || result.includes("youtube.com/user/"))) {
    console.log(`[socialDiscoverer] DuckDuckGo found YouTube: ${result}`);
    return result;
  }
  return null;
}

/**
 * Search DuckDuckGo for the brand's subreddit URL.
 */
async function searchRedditSubreddit(brandName: string): Promise<string | null> {
  const result = await searchDuckDuckGo(`site:reddit.com/r/ ${brandName}`);
  if (result && result.includes("reddit.com/r/")) {
    console.log(`[socialDiscoverer] DuckDuckGo found Reddit: ${result}`);
    return result;
  }
  return null;
}

export async function discoverSocialMedia(
  brandHandle: string,
  websiteSocialLinks?: {
    youtube?: string | null;
    reddit?: string | null;
    twitter?: string | null;
    linkedin?: string | null;
    instagram?: string | null;
  }
): Promise<SocialData> {
  console.log(`[socialDiscoverer] Discovering social presence for ${brandHandle}...`);
  console.log('[socialDiscoverer] Inputs - brandHandle:', brandHandle, 'websiteSocialLinks:', websiteSocialLinks);

  const socialData: SocialData = {
    youtube: {
      channelFound: false,
      subscriberCount: "N/A",
      videoCount: "N/A",
      viewCount: "N/A",
      channelDescription: "",
      recentVideoTitles: []
    },
    reddit: {
      subredditFound: false,
      subscribers: 0,
      activeUsers: 0,
      description: "",
      topPostTitles: [],
      sentimentSummary: ""
    },
    twitterFound: false,
    linkedinFound: false,
    instagramFound: false
  };

  const handle = brandHandle.toLowerCase().replace(/[^a-z0-9_]/g, "");

  // 1. YouTube discovery
  let ytChannelUrl = websiteSocialLinks?.youtube || "";
  let ytHandle = "";
  let ytChannelId = "";

  if (ytChannelUrl) {
    // Try parsing url using URL object
    try {
      const parsedUrl = new URL(ytChannelUrl.startsWith("http") ? ytChannelUrl : `https://${ytChannelUrl}`);
      const pathSegments = parsedUrl.pathname.split("/").filter(Boolean);
      if (pathSegments.length > 0) {
        const lastSegment = pathSegments[pathSegments.length - 1];
        const secondLast = pathSegments[pathSegments.length - 2];
        if (secondLast === "channel" && lastSegment.startsWith("UC")) {
          ytChannelId = lastSegment;
        } else if (lastSegment.startsWith("@")) {
          ytHandle = lastSegment;
        } else if (secondLast === "c" || secondLast === "user") {
          ytHandle = lastSegment;
        } else {
          ytHandle = lastSegment;
        }
      }
    } catch {
      const idMatch = ytChannelUrl.match(/channel\/(UC[a-zA-Z0-9_\-]+)/);
      if (idMatch) {
        ytChannelId = idMatch[1];
      } else {
        const match = ytChannelUrl.match(/(?:@|c\/|user\/)?([a-zA-Z0-9_\-]+)/i);
        if (match) ytHandle = match[1];
      }
    }
  }

  if (!ytHandle && !ytChannelId) {
    ytHandle = handle;
  }

  let ytExists = !!ytChannelUrl;
  if (!ytExists && ytHandle) {
    ytExists = await checkUrlExists(`youtube.com/@${ytHandle}`) || await checkUrlExists(`youtube.com/c/${ytHandle}`);
  }

  // DuckDuckGo fallback: search for the brand's YouTube channel if direct probe failed
  if (!ytExists && !ytChannelId) {
    console.log(`[socialDiscoverer] Direct YouTube probe failed for '${ytHandle}', trying DuckDuckGo fallback...`);
    const ddgYtUrl = await searchYouTubeChannel(brandHandle);
    if (ddgYtUrl) {
      ytChannelUrl = ddgYtUrl;
      ytExists = true;
      // Re-parse the discovered URL
      try {
        const parsedUrl = new URL(ddgYtUrl);
        const pathSegments = parsedUrl.pathname.split("/").filter(Boolean);
        if (pathSegments.length > 0) {
          const lastSegment = pathSegments[pathSegments.length - 1];
          const secondLast = pathSegments.length > 1 ? pathSegments[pathSegments.length - 2] : "";
          if (secondLast === "channel" && lastSegment.startsWith("UC")) {
            ytChannelId = lastSegment;
            ytHandle = "";
          } else if (lastSegment.startsWith("@")) {
            ytHandle = lastSegment;
          } else {
            ytHandle = lastSegment;
          }
        }
      } catch { /* ignore parse errors */ }
    }
  }

  if (ytExists && YOUTUBE_API_KEY) {
    try {
      let targetUrl = "";
      if (ytChannelId) {
        targetUrl = `https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet,contentDetails&id=${encodeURIComponent(ytChannelId)}&key=${YOUTUBE_API_KEY}`;
      } else {
        const formattedHandle = ytHandle.startsWith("@") ? ytHandle : `@${ytHandle}`;
        targetUrl = `https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet,contentDetails&forHandle=${encodeURIComponent(formattedHandle)}&key=${YOUTUBE_API_KEY}`;
      }

      console.log(`[socialDiscoverer] Fetching YouTube channel from API...`);
      const channelRes = await fetch(targetUrl);
      if (channelRes.ok) {
        const chanData = await channelRes.json() as any;
        const channel = chanData?.items?.[0];
        
        if (channel) {
          socialData.youtube!.channelFound = true;
          socialData.youtube!.subscriberCount = channel.statistics?.subscriberCount ? Number(channel.statistics.subscriberCount).toLocaleString() : "N/A";
          socialData.youtube!.videoCount = channel.statistics?.videoCount ? Number(channel.statistics.videoCount).toLocaleString() : "N/A";
          socialData.youtube!.viewCount = channel.statistics?.viewCount ? Number(channel.statistics.viewCount).toLocaleString() : "N/A";
          socialData.youtube!.channelDescription = channel.snippet?.description || "";
          
          const channelId = channel.id;
          const feedRes = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`);
          if (feedRes.ok) {
            const xmlText = await feedRes.text();
            const titleMatches = xmlText.matchAll(/<title>([^<]+)<\/title>/g);
            const titles: string[] = [];
            for (const m of titleMatches) {
              titles.push(m[1]);
            }
            socialData.youtube!.recentVideoTitles = titles.slice(1, 6);
          }
        } else {
          console.warn(`[socialDiscoverer] No YouTube channel found for handle: ${ytHandle} or ID: ${ytChannelId}`);
        }
      }
    } catch (err) {
      console.error("[socialDiscoverer] Error fetching YouTube details:", err);
    }
  }

  // 2. Reddit discovery
  let redditUrl = websiteSocialLinks?.reddit || "";
  let subreddit = handle;
  if (redditUrl) {
    const match = redditUrl.match(/\/r\/([a-zA-Z0-9_\-]+)/);
    if (match) subreddit = match[1];
  }

  let redditExists = !!redditUrl;
  if (!redditExists) {
    redditExists = await checkUrlExists(`reddit.com/r/${subreddit}`);
  }

  // DuckDuckGo fallback: search for the brand's subreddit if direct probe failed
  if (!redditExists) {
    console.log(`[socialDiscoverer] Direct Reddit probe failed for 'r/${subreddit}', trying DuckDuckGo fallback...`);
    const ddgRedditUrl = await searchRedditSubreddit(brandHandle);
    if (ddgRedditUrl) {
      const match = ddgRedditUrl.match(/\/r\/([a-zA-Z0-9_\-]+)/);
      if (match) {
        subreddit = match[1];
        redditExists = true;
        console.log(`[socialDiscoverer] DuckDuckGo discovered subreddit: r/${subreddit}`);
      }
    }
  }

  if (redditExists) {
    console.log(`[socialDiscoverer] Querying Subreddit: r/${subreddit}`);
    try {
      const aboutRes = await fetch(`https://www.reddit.com/r/${subreddit}/about.json`, {
        headers: { "User-Agent": REDDIT_USER_AGENT }
      });
      if (aboutRes.ok) {
        const aboutData = await aboutRes.json() as any;
        if (aboutData?.data) {
          socialData.reddit!.subredditFound = true;
          socialData.reddit!.subscribers = aboutData.data.subscribers || 0;
          socialData.reddit!.activeUsers = aboutData.data.active_user_count || 0;
          socialData.reddit!.description = aboutData.data.public_description || "";
        }
      }

      if (socialData.reddit!.subredditFound) {
        const topRes = await fetch(`https://www.reddit.com/r/${subreddit}/top.json?limit=5`, {
          headers: { "User-Agent": REDDIT_USER_AGENT }
        });
        if (topRes.ok) {
          const topData = await topRes.json() as any;
          const posts = topData?.data?.children || [];
          const titles = posts.map((p: any) => p.data?.title || "");
          socialData.reddit!.topPostTitles = titles;

          if (titles.length > 0) {
            const truncatedReddit = truncateContent(JSON.stringify(titles), 4000);
            const sentimentPrompt = `Summarize the overall sentiment and main topics discussed in this subreddit in 2-3 sentences based on these top post titles:
${truncatedReddit}

Return as JSON:
{
  "summary": "your 2-3 sentence summary here"
}
Return only valid JSON, no markdown.`;
            const sentimentObj = await runGroqPrompt<{ summary: string }>(sentimentPrompt, 0.3);
            socialData.reddit!.sentimentSummary = sentimentObj?.summary || "";
          }
        }
      }
    } catch (err) {
      console.error("[socialDiscoverer] Error fetching Reddit details:", err);
    }
  }

  // 3. Twitter, LinkedIn, Instagram presence
  socialData.twitterFound = !!websiteSocialLinks?.twitter || await checkUrlExists(`twitter.com/${handle}`) || await checkUrlExists(`x.com/${handle}`);
  socialData.linkedinFound = !!websiteSocialLinks?.linkedin || await checkUrlExists(`linkedin.com/company/${handle}`);
  socialData.instagramFound = !!websiteSocialLinks?.instagram || await checkUrlExists(`instagram.com/${handle}`);

  return socialData;
}
