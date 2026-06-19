import { SocialData } from "../types.js";
import { runGroqPrompt } from "../lib/groq.js";
import { truncateContent } from "../lib/jina.js";
import dotenv from "dotenv";

dotenv.config();

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const REDDIT_USER_AGENT = process.env.REDDIT_USER_AGENT || "CompetitorScan/1.0";

/**
 * Use YouTube Data API search to find a brand's channel by name.
 * This is the reliable fallback when we don't have the exact handle.
 */
async function searchYouTubeByAPI(brandName: string): Promise<{ channelId: string; handle: string } | null> {
  if (!YOUTUBE_API_KEY) {
    console.log(`[socialDiscoverer] No YOUTUBE_API_KEY — cannot search YouTube API`);
    return null;
  }
  try {
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(brandName)}&maxResults=3&key=${YOUTUBE_API_KEY}`;
    console.log(`[socialDiscoverer] YouTube API search for "${brandName}"...`);
    const res = await fetch(searchUrl);
    if (!res.ok) {
      console.error(`[socialDiscoverer] YouTube search API returned ${res.status}: ${await res.text()}`);
      return null;
    }
    const data = await res.json() as any;
    const items = data?.items || [];
    console.log(`[socialDiscoverer] YouTube search returned ${items.length} results`);

    if (items.length === 0) return null;

    // Find best match: prefer channel title that contains the brand name
    const brandLower = brandName.toLowerCase().replace(/[^a-z0-9]/g, "");
    let bestMatch = items[0]; // default to first result
    for (const item of items) {
      const title = (item.snippet?.channelTitle || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      if (title === brandLower || title.includes(brandLower)) {
        bestMatch = item;
        break;
      }
    }

    const channelId = bestMatch.snippet?.channelId || bestMatch.id?.channelId;
    const channelTitle = bestMatch.snippet?.channelTitle || "";
    console.log(`[socialDiscoverer] YouTube API best match: "${channelTitle}" (ID: ${channelId})`);

    if (channelId) {
      return { channelId, handle: channelTitle };
    }
    return null;
  } catch (err) {
    console.error("[socialDiscoverer] YouTube API search error:", err);
    return null;
  }
}

/**
 * Try to find a subreddit by testing multiple name variants.
 * Reddit's about.json endpoint is reliable and case-insensitive.
 */
async function findSubreddit(brandName: string): Promise<string | null> {
  // Generate name variants to try
  const clean = brandName.replace(/[^a-zA-Z0-9_]/g, "");
  const variants = [
    clean,                                       // "Notion"
    clean.toLowerCase(),                         // "notion"
    clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase(), // "Notion"
    clean + "app",                               // "Notionapp"
    clean.toLowerCase() + "app",                 // "notionapp"
  ];
  // Deduplicate
  const uniqueVariants = [...new Set(variants)];

  console.log(`[socialDiscoverer] Reddit: trying subreddit variants: ${JSON.stringify(uniqueVariants)}`);

  for (const variant of uniqueVariants) {
    try {
      const aboutUrl = `https://www.reddit.com/r/${variant}/about.json`;
      console.log(`[socialDiscoverer] Reddit: probing r/${variant}...`);
      const res = await fetch(aboutUrl, {
        headers: { "User-Agent": REDDIT_USER_AGENT },
        redirect: "follow"
      });

      if (res.ok) {
        const data = await res.json() as any;
        // Check it's a real subreddit (not a redirect to search)
        if (data?.data?.subscribers && data.data.subscribers > 0) {
          const realName = data.data.display_name || variant;
          console.log(`[socialDiscoverer] Reddit: found r/${realName} with ${data.data.subscribers} subscribers`);
          return realName;
        }
      }
    } catch (err) {
      console.log(`[socialDiscoverer] Reddit: r/${variant} probe failed:`, err);
    }
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
  console.log(`[socialDiscoverer] ========== STARTING SOCIAL DISCOVERY ==========`);
  console.log(`[socialDiscoverer] brandHandle: "${brandHandle}"`);
  console.log(`[socialDiscoverer] websiteSocialLinks: ${JSON.stringify(websiteSocialLinks, null, 2)}`);

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
  console.log(`[socialDiscoverer] Sanitized handle: "${handle}"`);

  // =====================================================
  // 1. YOUTUBE DISCOVERY
  // =====================================================
  console.log(`[socialDiscoverer] --- YouTube Discovery ---`);

  let ytChannelUrl = websiteSocialLinks?.youtube || "";
  let ytHandle = "";
  let ytChannelId = "";

  // Step A: Parse social link from website if available
  if (ytChannelUrl) {
    console.log(`[socialDiscoverer] YouTube link from website: "${ytChannelUrl}"`);
    try {
      const parsedUrl = new URL(ytChannelUrl.startsWith("http") ? ytChannelUrl : `https://${ytChannelUrl}`);
      const pathSegments = parsedUrl.pathname.split("/").filter(Boolean);
      console.log(`[socialDiscoverer] YouTube URL path segments: ${JSON.stringify(pathSegments)}`);
      if (pathSegments.length > 0) {
        const lastSegment = pathSegments[pathSegments.length - 1];
        const secondLast = pathSegments.length > 1 ? pathSegments[pathSegments.length - 2] : "";
        if (secondLast === "channel" && lastSegment.startsWith("UC")) {
          ytChannelId = lastSegment;
          console.log(`[socialDiscoverer] Parsed channel ID from URL: ${ytChannelId}`);
        } else if (lastSegment.startsWith("@")) {
          ytHandle = lastSegment;
          console.log(`[socialDiscoverer] Parsed @handle from URL: ${ytHandle}`);
        } else if (secondLast === "c" || secondLast === "user") {
          ytHandle = lastSegment;
          console.log(`[socialDiscoverer] Parsed c/user handle from URL: ${ytHandle}`);
        } else {
          ytHandle = lastSegment;
          console.log(`[socialDiscoverer] Parsed generic handle from URL: ${ytHandle}`);
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
      console.log(`[socialDiscoverer] Regex-parsed from URL: handle="${ytHandle}" channelId="${ytChannelId}"`);
    }
  } else {
    console.log(`[socialDiscoverer] No YouTube link from website scrape`);
  }

  // Step B: If no handle/id from website, default to sanitized brand handle
  if (!ytHandle && !ytChannelId) {
    ytHandle = handle;
    console.log(`[socialDiscoverer] Defaulting YouTube handle to: "${ytHandle}"`);
  }

  // Step C: Try YouTube Data API directly with handle (skip unreliable HEAD probes)
  let ytFound = false;

  if (ytChannelId && YOUTUBE_API_KEY) {
    // We have a channel ID — go straight to the API
    console.log(`[socialDiscoverer] Have channel ID "${ytChannelId}", querying API directly...`);
    ytFound = true;
  } else if (YOUTUBE_API_KEY) {
    // Try forHandle lookup first
    console.log(`[socialDiscoverer] Trying YouTube API forHandle lookup with "${ytHandle}"...`);
    const formattedHandle = ytHandle.startsWith("@") ? ytHandle : `@${ytHandle}`;
    const handleUrl = `https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet,contentDetails&forHandle=${encodeURIComponent(formattedHandle)}&key=${YOUTUBE_API_KEY}`;
    try {
      const handleRes = await fetch(handleUrl);
      if (handleRes.ok) {
        const handleData = await handleRes.json() as any;
        const channel = handleData?.items?.[0];
        if (channel) {
          ytChannelId = channel.id;
          ytFound = true;
          console.log(`[socialDiscoverer] forHandle lookup SUCCESS! Channel: "${channel.snippet?.title}" ID: ${ytChannelId}`);
        } else {
          console.log(`[socialDiscoverer] forHandle lookup returned 0 items for "${formattedHandle}"`);
        }
      }
    } catch (err) {
      console.error(`[socialDiscoverer] forHandle lookup error:`, err);
    }

    // Step D: If forHandle failed, use YouTube search API as fallback
    if (!ytFound) {
      console.log(`[socialDiscoverer] forHandle failed. Falling back to YouTube Search API for "${brandHandle}"...`);
      const searchResult = await searchYouTubeByAPI(brandHandle);
      if (searchResult) {
        ytChannelId = searchResult.channelId;
        ytFound = true;
        console.log(`[socialDiscoverer] YouTube Search API found channel: ID=${ytChannelId}`);
      } else {
        console.log(`[socialDiscoverer] YouTube Search API also returned no results`);
      }
    }
  } else {
    console.log(`[socialDiscoverer] No YOUTUBE_API_KEY available — skipping YouTube`);
  }

  // Step E: Fetch full channel details if we found one
  if (ytFound && ytChannelId && YOUTUBE_API_KEY) {
    try {
      const detailUrl = `https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet,contentDetails&id=${encodeURIComponent(ytChannelId)}&key=${YOUTUBE_API_KEY}`;
      console.log(`[socialDiscoverer] Fetching full YouTube channel details for ID: ${ytChannelId}...`);
      const channelRes = await fetch(detailUrl);
      if (channelRes.ok) {
        const chanData = await channelRes.json() as any;
        const channel = chanData?.items?.[0];

        if (channel) {
          socialData.youtube!.channelFound = true;
          socialData.youtube!.subscriberCount = channel.statistics?.subscriberCount ? Number(channel.statistics.subscriberCount).toLocaleString() : "N/A";
          socialData.youtube!.videoCount = channel.statistics?.videoCount ? Number(channel.statistics.videoCount).toLocaleString() : "N/A";
          socialData.youtube!.viewCount = channel.statistics?.viewCount ? Number(channel.statistics.viewCount).toLocaleString() : "N/A";
          socialData.youtube!.channelDescription = channel.snippet?.description || "";
          console.log(`[socialDiscoverer] ✅ YouTube FOUND: "${channel.snippet?.title}" | ${socialData.youtube!.subscriberCount} subs | ${socialData.youtube!.videoCount} videos`);

          // Fetch recent video titles from RSS feed
          const feedRes = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${ytChannelId}`);
          if (feedRes.ok) {
            const xmlText = await feedRes.text();
            const titleMatches = xmlText.matchAll(/<title>([^<]+)<\/title>/g);
            const titles: string[] = [];
            for (const m of titleMatches) {
              titles.push(m[1]);
            }
            socialData.youtube!.recentVideoTitles = titles.slice(1, 6);
            console.log(`[socialDiscoverer] YouTube recent videos: ${socialData.youtube!.recentVideoTitles.length} fetched`);
          }
        } else {
          console.warn(`[socialDiscoverer] Channel detail API returned 0 items for ID: ${ytChannelId}`);
        }
      }
    } catch (err) {
      console.error("[socialDiscoverer] Error fetching YouTube channel details:", err);
    }
  }

  // =====================================================
  // 2. REDDIT DISCOVERY
  // =====================================================
  console.log(`[socialDiscoverer] --- Reddit Discovery ---`);

  let redditUrl = websiteSocialLinks?.reddit || "";
  let subreddit = "";

  // Step A: Parse subreddit from website link
  if (redditUrl) {
    console.log(`[socialDiscoverer] Reddit link from website: "${redditUrl}"`);
    const match = redditUrl.match(/\/r\/([a-zA-Z0-9_\-]+)/);
    if (match) {
      subreddit = match[1];
      console.log(`[socialDiscoverer] Parsed subreddit from link: r/${subreddit}`);
    }
  }

  // Step B: If no subreddit from link, try multiple name variants
  if (!subreddit) {
    console.log(`[socialDiscoverer] No subreddit from website link. Trying name variants...`);
    const found = await findSubreddit(brandHandle);
    if (found) {
      subreddit = found;
    } else {
      console.log(`[socialDiscoverer] ❌ No subreddit found for any variant of "${brandHandle}"`);
    }
  }

  // Step C: Fetch full subreddit data
  if (subreddit) {
    console.log(`[socialDiscoverer] Fetching full subreddit data for r/${subreddit}...`);
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
          console.log(`[socialDiscoverer] ✅ Reddit FOUND: r/${subreddit} | ${socialData.reddit!.subscribers.toLocaleString()} subscribers | ${socialData.reddit!.activeUsers.toLocaleString()} active`);
        }
      } else {
        console.log(`[socialDiscoverer] Reddit about.json returned ${aboutRes.status} for r/${subreddit}`);
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

  // =====================================================
  // 3. OTHER SOCIAL PLATFORMS
  // =====================================================
  console.log(`[socialDiscoverer] --- Other Platforms ---`);

  // For Twitter/LinkedIn/Instagram, just check if websiteAnalyzer found links
  socialData.twitterFound = !!websiteSocialLinks?.twitter;
  socialData.linkedinFound = !!websiteSocialLinks?.linkedin;
  socialData.instagramFound = !!websiteSocialLinks?.instagram;

  // If no links from website, try simple HEAD probes as a heuristic
  if (!socialData.twitterFound) {
    try {
      const xRes = await fetch(`https://x.com/${handle}`, { method: "HEAD", redirect: "follow" });
      socialData.twitterFound = xRes.status >= 200 && xRes.status < 400;
    } catch { /* ignore */ }
  }
  if (!socialData.linkedinFound) {
    try {
      const liRes = await fetch(`https://linkedin.com/company/${handle}`, { method: "HEAD", redirect: "follow" });
      socialData.linkedinFound = liRes.status >= 200 && liRes.status < 400;
    } catch { /* ignore */ }
  }
  if (!socialData.instagramFound) {
    try {
      const igRes = await fetch(`https://instagram.com/${handle}`, { method: "HEAD", redirect: "follow" });
      socialData.instagramFound = igRes.status >= 200 && igRes.status < 400;
    } catch { /* ignore */ }
  }

  console.log(`[socialDiscoverer] Twitter: ${socialData.twitterFound}, LinkedIn: ${socialData.linkedinFound}, Instagram: ${socialData.instagramFound}`);
  console.log(`[socialDiscoverer] ========== SOCIAL DISCOVERY COMPLETE ==========`);

  return socialData;
}
