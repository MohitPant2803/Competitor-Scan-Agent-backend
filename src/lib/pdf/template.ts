import { CompetitorReport } from "../../types";

export function getHtmlTemplate(report: CompetitorReport): string {
  const dateStr = new Date(report.createdAt).toLocaleDateString("en-US", {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const website = report.websiteData;
  const pricing = report.pricingData;
  const seo = report.seoData;
  const social = report.socialData;
  const content = report.contentData;
  const swot = report.swotData;

  // Helper for rendering arrays of strings as bullet points or badges
  const renderList = (items?: string[]) => {
    if (!items || items.length === 0) return `<p class="empty-state">Data unavailable</p>`;
    return `<ul class="bullet-list">${items.map(item => `<li>${item}</li>`).join("")}</ul>`;
  };

  // Helper to color score values
  const getScoreColorClass = (score: number) => {
    if (score >= 90) return "score-good";
    if (score >= 50) return "score-average";
    return "score-poor";
  };

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>CompetitorScan Report - ${website?.companyName || report.url}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    @page {
      size: A4;
      margin: 20mm;
      @bottom-right {
        content: counter(page);
        font-family: 'Inter', sans-serif;
        font-size: 8pt;
        color: #94A3B8;
      }
    }
    
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Inter', sans-serif;
      color: #334155;
      line-height: 1.6;
      background-color: #FFFFFF;
      font-size: 10pt;
    }

    h1, h2, h3, h4 {
      color: #0F172A;
      font-weight: 700;
    }

    .page-break {
      page-break-before: always;
    }

    /* Cover Page */
    .cover {
      height: 100vh;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 40mm 0;
      page-break-after: always;
    }

    .cover-top {
      border-left: 6px solid #3B82F6;
      padding-left: 24px;
    }

    .brand {
      font-size: 16pt;
      font-weight: 800;
      color: #3B82F6;
      text-transform: uppercase;
      letter-spacing: 2px;
      margin-bottom: 20px;
    }

    .report-title {
      font-size: 36pt;
      line-height: 1.2;
      color: #0F172A;
      font-weight: 800;
      margin-bottom: 8px;
    }

    .report-subtitle {
      font-size: 14pt;
      color: #64748B;
      font-weight: 400;
      word-break: break-all;
    }

    .cover-bottom {
      border-top: 1px solid #E2E8F0;
      padding-top: 30px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }

    .meta-item label {
      font-size: 9pt;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #94A3B8;
      font-weight: 600;
      display: block;
      margin-bottom: 4px;
    }

    .meta-item value {
      font-size: 11pt;
      color: #334155;
      font-weight: 600;
      display: block;
    }

    /* Page Setup */
    .section {
      margin-bottom: 30px;
    }

    .section-title {
      font-size: 18pt;
      color: #0F172A;
      border-bottom: 2px solid #E2E8F0;
      padding-bottom: 8px;
      margin-bottom: 20px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
    }

    .grid-3 {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 15px;
    }

    .card {
      background-color: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 8px;
      padding: 18px;
      margin-bottom: 15px;
    }

    .card-title {
      font-size: 11pt;
      font-weight: 700;
      color: #0F172A;
      margin-bottom: 10px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .empty-state {
      color: #94A3B8;
      font-style: italic;
    }

    .bullet-list {
      list-style-type: none;
    }

    .bullet-list li {
      position: relative;
      padding-left: 15px;
      margin-bottom: 6px;
    }

    .bullet-list li::before {
      content: "•";
      color: #3B82F6;
      font-weight: bold;
      position: absolute;
      left: 0;
    }

    /* Scores */
    .score-container {
      display: flex;
      justify-content: space-around;
      margin-bottom: 20px;
    }

    .score-circle {
      text-align: center;
    }

    .score-value {
      width: 70px;
      height: 70px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18pt;
      font-weight: 800;
      margin: 0 auto 8px auto;
      border: 4px solid;
    }

    .score-good {
      border-color: #10B981;
      color: #047857;
      background-color: #ECFDF5;
    }

    .score-average {
      border-color: #F59E0B;
      color: #B45309;
      background-color: #FFFBEB;
    }

    .score-poor {
      border-color: #EF4444;
      color: #B91C1C;
      background-color: #FEF2F2;
    }

    .score-label {
      font-size: 9pt;
      font-weight: 600;
      color: #64748B;
      text-transform: uppercase;
    }

    /* Badges */
    .badge-container {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .badge {
      background-color: #EFF6FF;
      color: #1D4ED8;
      border: 1px solid #BFDBFE;
      padding: 4px 10px;
      border-radius: 9999px;
      font-size: 8.5pt;
      font-weight: 600;
    }

    /* Tables */
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
    }

    th, td {
      padding: 10px 12px;
      text-align: left;
      border-bottom: 1px solid #E2E8F0;
    }

    th {
      background-color: #F1F5F9;
      color: #0F172A;
      font-weight: 700;
      font-size: 9pt;
      text-transform: uppercase;
    }

    td {
      font-size: 9.5pt;
    }

    .popular-row {
      background-color: #EFF6FF;
      font-weight: 600;
    }

    /* SWOT Matrix */
    .swot-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 15px;
      margin-top: 15px;
    }

    .swot-box {
      border-radius: 8px;
      padding: 18px;
      border: 1px solid;
    }

    .swot-box h3 {
      font-size: 13pt;
      margin-bottom: 10px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .swot-box ul {
      list-style-type: none;
    }

    .swot-box li {
      margin-bottom: 10px;
      font-size: 9pt;
    }

    .swot-box li strong {
      display: block;
      font-size: 9.5pt;
      margin-bottom: 2px;
    }

    .swot-s {
      background-color: #ECFDF5;
      border-color: #A7F3D0;
      color: #064E3B;
    }
    .swot-s h3 { color: #047857; }

    .swot-w {
      background-color: #FEF2F2;
      border-color: #FCA5A5;
      color: #7F1D1D;
    }
    .swot-w h3 { color: #B91C1C; }

    .swot-o {
      background-color: #EFF6FF;
      border-color: #BFDBFE;
      color: #1E3A8A;
    }
    .swot-o h3 { color: #1D4ED8; }

    .swot-t {
      background-color: #FFF7ED;
      border-color: #FFEDD5;
      color: #7C2D12;
    }
    .swot-t h3 { color: #C2410C; }

    /* Recommendations */
    .rec-card {
      display: flex;
      align-items: flex-start;
      background-color: #F8FAFC;
      border-left: 4px solid #3B82F6;
      padding: 15px;
      border-radius: 0 8px 8px 0;
      margin-bottom: 12px;
    }

    .rec-number {
      font-size: 18pt;
      font-weight: 800;
      color: #3B82F6;
      margin-right: 15px;
      line-height: 1;
    }

    .rec-text {
      font-size: 10pt;
      color: #334155;
    }

    /* Footer */
    .footer {
      border-top: 1px solid #E2E8F0;
      padding-top: 15px;
      margin-top: 40px;
      display: flex;
      justify-content: space-between;
      font-size: 8pt;
      color: #94A3B8;
    }
  </style>
</head>
<body>

  <!-- Cover Page -->
  <div class="cover">
    <div class="cover-top">
      <div class="brand">CompetitorScan Report</div>
      <h1 class="report-title">${website?.companyName || "Competitor Profile"}</h1>
      <p class="report-subtitle">${report.url}</p>
    </div>
    <div class="cover-bottom">
      <div class="meta-item">
        <label>Date Analyzed</label>
        <value>${dateStr}</value>
      </div>
      <div class="meta-item" style="text-align: right;">
        <label>Engine Version</label>
        <value>1.0 (Llama-3.3)</value>
      </div>
    </div>
  </div>

  <!-- Executive Summary -->
  <div class="section">
    <h2 class="section-title">Executive Summary</h2>
    <div class="card" style="border-left: 4px solid #0F172A; border-radius: 0 8px 8px 0;">
      <p style="font-size: 11pt; font-weight: 500; color: #1E293B;">
        ${swot?.executiveSummary || "No executive summary available for this company."}
      </p>
    </div>
  </div>

  <!-- Company Overview -->
  <div class="section">
    <h2 class="section-title">Company Overview</h2>
    <div class="grid-2">
      <div class="card">
        <h3 class="card-title">Profile & Description</h3>
        <p>${website?.description || "Description unavailable"}</p>
        <p style="margin-top: 12px;"><strong>Target Audience:</strong> ${website?.targetAudience || "Unavailable"}</p>
      </div>
      <div class="card">
        <h3 class="card-title">Unique Selling Points</h3>
        ${renderList(website?.uniqueSellingPoints)}
      </div>
    </div>
    <div class="card" style="margin-top: 15px;">
      <h3 class="card-title">Key Core Features</h3>
      <div class="badge-container">
        ${website?.mainFeatures?.map(feat => `<span class="badge">${feat}</span>`).join("") || `<span class="empty-state">No features listed</span>`}
      </div>
    </div>
  </div>

  <div class="page-break"></div>

  <!-- Pricing Analysis -->
  <div class="section">
    <h2 class="section-title">Pricing & Packages</h2>
    <div class="card">
      <p><strong>Pricing Model:</strong> <span style="text-transform: capitalize;">${pricing?.pricingModel || "N/A"}</span></p>
      <p><strong>Free Trial/Free Tier Available:</strong> ${pricing?.hasFreeTrialOrFreeTier ? "Yes" : "No"}</p>
      ${pricing?.notes ? `<p style="margin-top: 6px; font-style: italic; color: #64748B;">Note: ${pricing.notes}</p>` : ""}
    </div>
    
    ${pricing?.plans && pricing.plans.length > 0 ? `
    <table>
      <thead>
        <tr>
          <th>Plan Name</th>
          <th>Price</th>
          <th>Billing Cycle</th>
          <th>Features</th>
        </tr>
      </thead>
      <tbody>
        ${pricing.plans.map(plan => `
          <tr class="${plan.isPopular ? "popular-row" : ""}">
            <td><strong>${plan.name}</strong> ${plan.isPopular ? '<span style="background:#3B82F6;color:#FFF;font-size:7pt;padding:2px 6px;border-radius:4px;margin-left:4px;">Popular</span>' : ''}</td>
            <td>${plan.price}</td>
            <td style="text-transform: capitalize;">${plan.billingCycle}</td>
            <td style="font-size: 8.5pt;">${plan.features?.join(", ") || "None listed"}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
    ` : `<p class="empty-state">No pricing table plans available.</p>`}
  </div>

  <!-- SEO & Technology Stack -->
  <div class="section" style="margin-top: 30px;">
    <h2 class="section-title">SEO & Technology Stack</h2>
    
    ${seo ? `
    <div class="score-container">
      <div class="score-circle">
        <div class="score-value ${getScoreColorClass(seo.performanceScore)}">${seo.performanceScore}</div>
        <div class="score-label">Performance</div>
      </div>
      <div class="score-circle">
        <div class="score-value ${getScoreColorClass(seo.accessibilityScore)}">${seo.accessibilityScore}</div>
        <div class="score-label">Accessibility</div>
      </div>
      <div class="score-circle">
        <div class="score-value ${getScoreColorClass(seo.seoScore)}">${seo.seoScore}</div>
        <div class="score-label">SEO</div>
      </div>
      <div class="score-circle">
        <div class="score-value ${getScoreColorClass(seo.bestPracticesScore)}">${seo.bestPracticesScore}</div>
        <div class="score-label">Best Practices</div>
      </div>
    </div>

    <div class="grid-2">
      <div class="card">
        <h3 class="card-title">Core Web Vitals</h3>
        <p><strong>Largest Contentful Paint (LCP):</strong> ${seo.LCP}</p>
        <p><strong>Cumulative Layout Shift (CLS):</strong> ${seo.CLS}</p>
        <p><strong>First Input Delay (FID):</strong> ${seo.FID}</p>
        <p><strong>Time to Interactive (TTI):</strong> ${seo.TTI}</p>
      </div>
      <div class="card">
        <h3 class="card-title">Technologies Detected</h3>
        <div class="badge-container" style="margin-top: 5px;">
          ${seo.technologies?.map(tech => `<span class="badge" style="background-color:#F1F5F9; color:#475569; border-color:#CBD5E1;">${tech}</span>`).join("") || "N/A"}
        </div>
      </div>
    </div>
    ` : `<p class="empty-state">SEO data unavailable.</p>`}
  </div>

  <div class="page-break"></div>

  <!-- Social Media Presence -->
  <div class="section">
    <h2 class="section-title">Social Presence & Sentiment</h2>
    
    <div class="grid-2">
      <!-- YouTube Card -->
      <div class="card">
        <h3 class="card-title">YouTube Presence</h3>
        ${social?.youtube?.channelFound ? `
          <p><strong>Subscribers:</strong> ${social.youtube.subscriberCount}</p>
          <p><strong>Total Views:</strong> ${social.youtube.viewCount}</p>
          <p><strong>Videos Uploaded:</strong> ${social.youtube.videoCount}</p>
          <p style="font-size: 8.5pt; color: #64748B; margin-top: 8px; margin-bottom: 8px;">${social.youtube.channelDescription || ""}</p>
          <p style="font-size: 9pt; font-weight: 600; margin-top: 6px;">Recent Videos:</p>
          <ul style="list-style-type: none; font-size: 8.5pt; padding-left: 0;">
            ${social.youtube.recentVideoTitles?.map(v => `<li style="margin-bottom: 4px; border-bottom: 1px solid #F1F5F9;">🎬 ${v}</li>`).join("") || "<li>None</li>"}
          </ul>
        ` : `
          <p class="empty-state">No active YouTube presence discovered</p>
        `}
      </div>

      <!-- Reddit Card -->
      <div class="card">
        <h3 class="card-title">Reddit Community</h3>
        ${social?.reddit?.subredditFound ? `
          <p><strong>Subscribers:</strong> ${social.reddit.subscribers.toLocaleString()}</p>
          <p><strong>Active Users:</strong> ${social.reddit.activeUsers.toLocaleString()}</p>
          <p style="font-size: 8.5pt; color: #64748B; margin-top: 8px; margin-bottom: 8px;">${social.reddit.description || ""}</p>
          ${social.reddit.sentimentSummary ? `
            <div style="background-color: #FFF; border-left: 2px solid #3B82F6; padding: 6px 10px; margin-top: 10px;">
              <strong style="font-size: 8pt; text-transform: uppercase; color: #3B82F6; display: block;">Sentiment Analysis</strong>
              <span style="font-size: 8.5pt; font-style: italic;">${social.reddit.sentimentSummary}</span>
            </div>
          ` : ""}
        ` : `
          <p class="empty-state">No official subreddit community discovered</p>
        `}
      </div>
    </div>

    <!-- Other Channels -->
    <div class="card" style="margin-top: 15px;">
      <h3 class="card-title">Other Channels Existence</h3>
      <div class="badge-container">
        <span class="badge" style="background-color: ${social?.twitterFound ? "#E0F2FE; color: #0369A1" : "#F1F5F9; color:#94A3B8"};">Twitter/X: ${social?.twitterFound ? "Detected" : "Not Found"}</span>
        <span class="badge" style="background-color: ${social?.linkedinFound ? "#E0F2FE; color: #0369A1" : "#F1F5F9; color:#94A3B8"};">LinkedIn: ${social?.linkedinFound ? "Detected" : "Not Found"}</span>
        <span class="badge" style="background-color: ${social?.instagramFound ? "#E0F2FE; color: #0369A1" : "#F1F5F9; color:#94A3B8"};">Instagram: ${social?.instagramFound ? "Detected" : "Not Found"}</span>
      </div>
    </div>
  </div>

  <!-- Content Strategy -->
  <div class="section" style="margin-top: 30px;">
    <h2 class="section-title">Content & Editorial Strategy</h2>
    <div class="card">
      ${content ? `
        <p><strong>Active Blog/Resources:</strong> ${content.hasActiveBlog ? "Yes" : "No"}</p>
        <p><strong>Posting Frequency:</strong> ${content.postingFrequency || "Unknown"}</p>
        <p><strong>Estimated Last Post Date:</strong> ${content.estimatedLastPost || "N/A"}</p>
        <div style="margin-top: 10px;">
          <strong>Content Strategy Summary:</strong>
          <p style="font-style: italic; color: #475569; margin-top: 4px;">${content.contentStrategy || "N/A"}</p>
        </div>
        <div style="margin-top: 12px;">
          <strong>Primary Topics Focused:</strong>
          <div class="badge-container" style="margin-top: 6px;">
            ${content.mainTopics?.map(topic => `<span class="badge" style="background-color:#F8FAFC; color:#64748B; border-color:#E2E8F0;">${topic}</span>`).join("") || "N/A"}
          </div>
        </div>
      ` : `<p class="empty-state">Content strategy data unavailable.</p>`}
    </div>
  </div>

  <div class="page-break"></div>

  <!-- SWOT Analysis -->
  <div class="section">
    <h2 class="section-title">SWOT Matrix</h2>
    
    <div class="swot-grid">
      <!-- Strengths -->
      <div class="swot-box swot-s">
        <h3>Strengths</h3>
        <ul>
          ${swot?.strengths?.map(s => `<li><strong>${s.point}</strong>${s.detail}</li>`).join("") || "<li>Data unavailable</li>"}
        </ul>
      </div>

      <!-- Weaknesses -->
      <div class="swot-box swot-w">
        <h3>Weaknesses</h3>
        <ul>
          ${swot?.weaknesses?.map(w => `<li><strong>${w.point}</strong>${w.detail}</li>`).join("") || "<li>Data unavailable</li>"}
        </ul>
      </div>

      <!-- Opportunities -->
      <div class="swot-box swot-o">
        <h3>Opportunities</h3>
        <ul>
          ${swot?.opportunities?.map(o => `<li><strong>${o.point}</strong>${o.detail}</li>`).join("") || "<li>Data unavailable</li>"}
        </ul>
      </div>

      <!-- Threats -->
      <div class="swot-box swot-t">
        <h3>Threats</h3>
        <ul>
          ${swot?.threats?.map(t => `<li><strong>${t.point}</strong>${t.detail}</li>`).join("") || "<li>Data unavailable</li>"}
        </ul>
      </div>
    </div>
  </div>

  <!-- Recommendations -->
  <div class="section" style="margin-top: 40px;">
    <h2 class="section-title">Strategic Recommendations</h2>
    ${swot?.strategicRecommendations?.map((rec, idx) => `
      <div class="rec-card">
        <div class="rec-number">0${idx + 1}</div>
        <div class="rec-text">${rec}</div>
      </div>
    `).join("") || `<p class="empty-state">No recommendations generated.</p>`}
  </div>

  <!-- Report Footer -->
  <div class="footer">
    <div>Generated by CompetitorScan</div>
    <div>${dateStr} &bull; Page 1 of 1</div>
  </div>

</body>
</html>
  `;
}
