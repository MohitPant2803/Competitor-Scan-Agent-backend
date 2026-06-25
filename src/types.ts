export interface WebsiteData {
  companyName: string;
  description: string;
  targetAudience: string;
  mainFeatures: string[];
  uniqueSellingPoints: string[];
  socialLinks: {
    youtube?: string;
    reddit?: string;
    twitter?: string;
    linkedin?: string;
    instagram?: string;
  };
  brandHandle: string;
}

export interface PricingPlan {
  name: string;
  price: string;
  billingCycle: 'monthly' | 'yearly' | 'one-time';
  features: string[];
  isPopular: boolean;
}

export interface PricingData {
  hasPricing: boolean;
  pricingModel: 'subscription' | 'one-time' | 'usage-based' | 'freemium' | 'contact-sales';
  plans: PricingPlan[];
  hasFreeTrialOrFreeTier: boolean;
  notes: string;
}

export interface SEOData {
  performanceScore: number | null;
  accessibilityScore: number | null;
  seoScore: number | null;
  bestPracticesScore: number | null;
  LCP: string;
  CLS: string;
  FID: string;
  TTI: string;
  technologies: string[];
}

export interface SocialData {
  youtube?: {
    channelFound: boolean;
    subscriberCount: string;
    videoCount: string;
    viewCount: string;
    channelDescription: string;
    recentVideoTitles: string[];
  };
  reddit?: {
    subredditFound: boolean;
    subscribers: number;
    activeUsers: number;
    description: string;
    topPostTitles: string[];
    sentimentSummary: string;
  };
  twitterFound?: boolean;
  linkedinFound?: boolean;
  instagramFound?: boolean;
}

export interface ContentData {
  hasActiveBlog: boolean;
  postingFrequency: string;
  mainTopics: string[];
  contentStrategy: string;
  estimatedLastPost: string;
}

export interface SWOTPoint {
  point: string;
  detail: string;
}

export interface SWOTData {
  strengths: SWOTPoint[];
  weaknesses: SWOTPoint[];
  opportunities: SWOTPoint[];
  threats: SWOTPoint[];
  executiveSummary: string;
  strategicRecommendations: string[];
}

export interface CompetitorReport {
  id: string;
  url: string;
  createdAt: string;
  degradedMode?: boolean;
  websiteData?: WebsiteData;
  pricingData?: PricingData;
  seoData?: SEOData;
  socialData?: SocialData;
  contentData?: ContentData;
  swotData?: SWOTData;
}
