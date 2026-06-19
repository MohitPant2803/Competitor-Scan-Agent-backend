import { SocialData } from "../types";
import { runGroqPrompt } from "../lib/groq";
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
  
  const socialData: SocialData = {
    youtube: {
      channelFound: false,
      subscriberCount: "0",
      videoCount: "0",
      viewCount: "0",
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
  let ytHandle = handle;
  if (ytChannelUrl) {
    const match = ytChannelUrl.match(/(?:@|channel\/|c\/)([a-zA-Z0-9_\-]+)/);
    if (match) ytHandle = match[1];
  }

  // Double check existence if no direct link
  let ytExists = !!ytChannelUrl;
  if (!ytExists) {
    ytExists = await checkUrlExists(`youtube.com/@${ytHandle}`) || await checkUrlExists(`youtube.com/c/${ytHandle}`);
  }

  if (ytExists) {
    socialData.youtube!.channelFound = true;
    if (YOUTUBE_API_KEY) {
      try {
        const formattedHandle = ytHandle.startsWith("@") ? ytHandle : `@${ytHandle}`;
        const channelRes = await fetch(
          `https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet,contentDetails&forHandle=${encodeURIComponent(formattedHandle)}&key=${YOUTUBE_API_KEY}`
        );
        if (channelRes.ok) {
          const chanData = await channelRes.json() as any;
          const channel = chanData?.items?.[0];
          if (channel) {
            socialData.youtube!.subscriberCount = channel.statistics?.subscriberCount || "0";
            socialData.youtube!.videoCount = channel.statistics?.videoCount || "0";
            socialData.youtube!.viewCount = channel.statistics?.viewCount || "0";
            socialData.youtube!.channelDescription = channel.snippet?.description || "";
            
            const channelId = channel.id;
            // Fetch recent videos via public XML feed to avoid search API cost or playlistItems complexity
            const feedRes = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`);
            if (feedRes.ok) {
              const xmlText = await feedRes.text();
              const titleMatches = xmlText.matchAll(/<title>([^<]+)<\/title>/g);
              const titles: string[] = [];
              for (const m of titleMatches) {
                // First title is channel title, subsequent are video titles
                titles.push(m[1]);
              }
              socialData.youtube!.recentVideoTitles = titles.slice(1, 6);
            }
          }
        }
      } catch (err) {
        console.error("[socialDiscoverer] Error fetching YouTube details:", err);
      }
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

  if (redditExists) {
    socialData.reddit!.subredditFound = true;
    try {
      const aboutRes = await fetch(`https://www.reddit.com/r/${subreddit}/about.json`, {
        headers: { "User-Agent": REDDIT_USER_AGENT }
      });
      if (aboutRes.ok) {
        const aboutData = await aboutRes.json() as any;
        socialData.reddit!.subscribers = aboutData?.data?.subscribers || 0;
        socialData.reddit!.activeUsers = aboutData?.data?.active_user_count || 0;
        socialData.reddit!.description = aboutData?.data?.public_description || "";
      }

      const topRes = await fetch(`https://www.reddit.com/r/${subreddit}/top.json?limit=5`, {
        headers: { "User-Agent": REDDIT_USER_AGENT }
      });
      if (topRes.ok) {
        const topData = await topRes.json() as any;
        const posts = topData?.data?.children || [];
        const titles = posts.map((p: any) => p.data?.title || "");
        socialData.reddit!.topPostTitles = titles;

        if (titles.length > 0) {
          const sentimentPrompt = `Summarize the overall sentiment and main topics discussed in this subreddit in 2-3 sentences based on these top post titles:
${JSON.stringify(titles)}

Return as JSON:
{
  "summary": "your 2-3 sentence summary here"
}
Return only valid JSON, no markdown.`;
          const sentimentObj = await runGroqPrompt<{ summary: string }>(sentimentPrompt, 0.3);
          socialData.reddit!.sentimentSummary = sentimentObj?.summary || "";
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
