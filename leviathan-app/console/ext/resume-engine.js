/* Leviathan browser app · Résumé Forge, the engine. No DOM, no network: pure functions the view (resume-forge.js) and the
   Node tests both call. Two sources: Clapback 4.3.0's résumé module (industry profiles, the plain-text ATS build, the
   Flesch–Kincaid grade, the weak-phrase flags, "match a posting") and Leviathan's findings on each agency
   (console/ext/resume-findings.js, generated at build time from the OmegaWeapon Agency Radar, the Hit Board and the
   Agency Field). The engine reads an agency's findings into gaps it shows and lines it sells, ranks the hiring tracks on
   demand and angle, collects the agency's own vocabulary, and builds, grades and lints the résumé.
   Honesty, as in Clapback: the candidate's facts come from the candidate alone. The agency decides the title, the headline,
   the summary, the order of the skills and which bullets to lead with; every suggested bullet carries [bracketed]
   placeholders and the lint refuses to call a résumé ready while one is left. Leviathan's own vocabulary (Horus, Monsoon,
   the Hit Board, the codes) is flagged if it leaks into the document: a résumé is not a pitch. */
(function () {
  'use strict';
  const G = typeof globalThis !== 'undefined' ? globalThis : window;
  const E = { version: '1.1.0' };

  /* ---------- the findings file ---------- */
  let F = null, BY = null;
  E.load = function (raw) {
    const f = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!f || !Array.isArray(f.agencies)) throw new Error('no findings');
    F = f; BY = Object.create(null); f.agencies.forEach(a => { BY[a.id] = a; });
    return F;
  };
  E.findings = function () { if (!F && typeof G.LV_FINDINGS_RAW === 'string') { try { E.load(G.LV_FINDINGS_RAW); } catch (e) { F = null; } } return F; };
  E.agency = id => { const f = E.findings(); return f && id ? (BY[id] || null) : null; };
  E.agencies = () => { const f = E.findings(); return f ? f.agencies : []; };
  E.byName = name => { const n = String(name || '').trim().toLowerCase(); if (!n) return null; return E.agencies().find(a => a.name.toLowerCase() === n) || E.agencies().find(a => a.name.toLowerCase().startsWith(n)) || null; };
  E.meta = () => { const f = E.findings(); return f ? { built: f.built, generated: f.generated, edition: f.edition, compiled: f.compiled, n: f.n, n_deep: f.n_deep } : (G.LV_FINDINGS_META || null); };

  /* ---------- vocabulary of the field ---------- */
  const DIM_LABEL = { seo: 'SEO', content_pr: 'Content & Digital PR', ai_search: 'AI Search / GEO', paid_search: 'Paid Search', paid_social: 'Paid Social', programmatic_ctv: 'Programmatic & CTV', retail_media: 'Retail Media', creator_influencer: 'Creator & Influencer', cro: 'CRO', web_dev: 'Web & Product', data_measurement: 'Data & Measurement', email_crm: 'Email & CRM', b2b_abm: 'B2B & ABM', local: 'Local', ai_automation: 'AI Automation / Agents' };
  const DIM_TRACK = { seo: 'N1', content_pr: 'N12', ai_search: 'N9', paid_search: 'N2', paid_social: 'N15', programmatic_ctv: 'N16', retail_media: 'N7', creator_influencer: 'N8', cro: 'N17', web_dev: 'N4', data_measurement: 'N5', email_crm: 'N6', b2b_abm: 'N11', local: 'N10', ai_automation: 'N9' };
  /* the Radar's client-need taxonomy (what clients buy) mapped onto the tracks (what agencies hire); one need feeds several */
  const NEED_TRACK = { N1: ['N1'], N2: ['N2', 'N15', 'N16'], N3: ['N3'], N4: ['N4', 'N17'], N5: ['N5'], N6: ['N6'], N7: ['N7'], N8: ['N8', 'N15'], N9: ['N9'], N10: ['N10', 'N2'], N11: ['N11', 'N15'], N12: ['N12'] };
  const KJ_TRACK = { KJ1: ['N9', 'N1'], KJ2: ['N2', 'N9'], KJ3: ['N9'], KJ4: ['N5', 'N16'], KJ5: ['N16', 'N3'], KJ6: ['N13', 'N14'], KJ7: ['N10'], KJ8: ['N8', 'N12'], KJ9: ['N5'], KJ10: ['N14'], KJ11: ['N12'] };
  const TOOL = { gtm: 'Google Tag Manager', hubspot: 'HubSpot', ga4: 'GA4', linkedin_insight: 'LinkedIn Insight Tag', meta_pixel: 'Meta Pixel', hotjar: 'Hotjar', vwo: 'VWO', ms_clarity: 'Microsoft Clarity', google_ads: 'Google Ads', callrail: 'CallRail', sixsense: '6sense', pardot: 'Pardot', zoominfo: 'ZoomInfo', dealfront_leadfeeder: 'Leadfeeder', rb2b: 'RB2B', clearbit: 'Clearbit', segment: 'Segment', tiktok_pixel: 'TikTok Pixel', x_pixel: 'X Pixel', microsoft_uet: 'Microsoft UET', reddit_pixel: 'Reddit Pixel', snap_pixel: 'Snap Pixel', calltrackingmetrics: 'CallTrackingMetrics', onetrust: 'OneTrust', cookiebot: 'Cookiebot', cookieyes: 'CookieYes', complianz: 'Complianz', usercentrics: 'Usercentrics', didomi: 'Didomi', axeptio: 'Axeptio', termly: 'Termly', osano: 'Osano', iubenda: 'iubenda' };
  const CONSENT = new Set(['onetrust', 'cookiebot', 'cookieyes', 'complianz', 'usercentrics', 'didomi', 'axeptio', 'termly', 'osano', 'iubenda']);
  const VERT = { crim: { label: 'Criminal defense', wing: 'legal', mod: 'criminal' }, pi: { label: 'Personal injury', wing: 'legal', mod: 'injury' }, fam: { label: 'Family law', wing: 'legal', mod: 'family' }, emp: { label: 'Employment law', wing: 'legal', mod: 'employment' }, legal: { label: 'Legal practices', wing: 'legal', mod: null }, hvac: { label: 'HVAC', wing: 'home', mod: 'hvac' }, roof: { label: 'Roofing', wing: 'home', mod: 'roofing' }, plumb: { label: 'Plumbing', wing: 'home', mod: 'plumbing' }, pest: { label: 'Pest control', wing: 'home', mod: 'pest' }, home: { label: 'Home services', wing: 'home', mod: null }, onc: { label: 'Oncology', wing: 'health', mod: 'oncology' }, dent: { label: 'Dental', wing: 'health', mod: 'dental' }, eye: { label: 'Eye care', wing: 'health', mod: 'ocular' }, health: { label: 'Healthcare', wing: 'health', mod: null } };
  const VERT_ORDER = ['crim', 'pi', 'fam', 'emp', 'legal', 'hvac', 'roof', 'plumb', 'pest', 'home', 'onc', 'dent', 'eye', 'health'];
  E.DIM_LABEL = DIM_LABEL; E.DIM_TRACK = DIM_TRACK; E.NEED_TRACK = NEED_TRACK; E.KJ_TRACK = KJ_TRACK; E.VERT = VERT; E.VERT_ORDER = VERT_ORDER; E.TOOL = TOOL;

  /* ---------- the tracks: the titles agencies post, with the alias for each level ---------- */
  const LEVELS = [['junior', 'Junior', 'Coordinator or specialist, under about two years'], ['mid', 'Mid', 'Owns accounts or channels, two to five years'], ['senior', 'Senior', 'Leads the craft, five to nine years'], ['manager', 'Manager', 'Runs a team, a book or a budget'], ['director', 'Director', 'Owns a practice: P&L, retention, headcount']];
  E.LEVELS = LEVELS;
  const T = (code, label, need, dims, titles, verbs, keywords, summary, notes, starters, asks) => ({ code, label, need, dims, titles, verbs, keywords, summary, notes, starters, asks });
  const TRACKS = [
    T('N1', 'SEO Manager', 'N1', ['seo', 'content_pr'], { junior: 'SEO Specialist', mid: 'SEO Manager', senior: 'Senior SEO Manager', manager: 'SEO Team Lead', director: 'Head of SEO' },
      ['Ranked', 'Grew', 'Recovered', 'Audited', 'Migrated', 'Structured', 'Mapped', 'Published', 'Consolidated', 'Scaled'],
      ['technical SEO', 'content strategy', 'keyword research', 'site migrations', 'Core Web Vitals', 'structured data', 'internal linking', 'GA4', 'Search Console', 'link acquisition', 'E-E-A-T', 'local SEO'],
      '%ROLE% with %YEARS% growing organic demand that survives algorithm updates and AI answers. Strong in %SKILL1% and %SKILL2%; ties rankings to revenue, not reports.',
      ['Lead bullets with the traffic, ranking and revenue numbers; name the sites and the scale.', 'Put the tools (GA4, Search Console, Screaming Frog, Ahrefs or Semrush) and the schema work in a scannable skills block.'],
      ['Grew organic sessions [X]% ([A] to [B] a month) for [client type] in [months] through [technical fix or content program]', 'Led [N] site migrations with [X]% of traffic retained at 90 days', 'Recovered [X]% of lost traffic after the [month] core update by [what you did]'],
      ['How do you tie organic traffic to revenue for clients today?', 'Which core updates hurt your clients last year, and what recovered them?']),
    T('N2', 'Paid Search Manager', 'N2', ['paid_search'], { junior: 'Paid Search Specialist', mid: 'Paid Search Manager', senior: 'Senior Paid Search Manager', manager: 'Paid Media Team Lead', director: 'Director of Paid Media' },
      ['Scaled', 'Cut', 'Optimized', 'Tested', 'Managed', 'Forecast', 'Structured', 'Launched', 'Reallocated', 'Lifted'],
      ['Google Ads', 'Microsoft Ads', 'Performance Max', 'Smart Bidding', 'ROAS', 'CPA', 'incrementality', 'conversion tracking', 'offline conversions', 'budget pacing', 'search term mining', 'Local Services Ads'],
      '%ROLE% with %YEARS% running paid search to a number. Strong in %SKILL1% and %SKILL2%; manages budgets the way the platforms’ automation cannot: with first-party data and tested offers.',
      ['Open with the spend you managed and the ROAS, CPA or cost per signed case you delivered.', 'Name the platforms and the measurement stack (GA4, conversions APIs, offline conversions): common ATS filters.'],
      ['Managed $[X] a month across Google and Microsoft Ads for [N] accounts, cutting cost per [lead, signed case or booked job] [Y]% while scaling volume [Z]%', 'Lifted ROAS from [A] to [B] by [restructure, first-party audiences or offer testing]', 'Ran [N] incrementality holdouts that moved $[X] from [channel] to [channel]'],
      ['How is paid search performance reported to clients: leads, signed cases, revenue?', 'Who runs the agency’s own Google Ads, and how is that account used in sales?']),
    T('N15', 'Paid Social Manager', 'N2', ['paid_social'], { junior: 'Paid Social Specialist', mid: 'Paid Social Manager', senior: 'Senior Paid Social Manager', manager: 'Paid Social Team Lead', director: 'Director of Paid Social' },
      ['Scaled', 'Tested', 'Produced', 'Cut', 'Instrumented', 'Launched', 'Lifted', 'Segmented', 'Managed', 'Optimized'],
      ['Meta Ads', 'TikTok Ads', 'LinkedIn Ads', 'Advantage+', 'Conversions API', 'Meta Pixel', 'creative testing', 'UGC', 'ROAS', 'CPA', 'audience segmentation', 'consent mode'],
      '%ROLE% with %YEARS% running paid social on measured creative. Strong in %SKILL1% and %SKILL2%; instruments the pixel and the Conversions API before spending a dollar.',
      ['Lead with spend, ROAS or CPA, and the creative volume you produced and tested.', 'Name the platforms and the instrumentation (Pixel, Conversions API, consent mode): the house test agencies fail most.'],
      ['Managed $[X] a month on Meta and TikTok for [N] accounts at [ROAS or CPA], testing [N] creatives a month', 'Instrumented Meta Pixel and Conversions API across [N] accounts, raising event match quality to [score] and cutting CPA [X]%', 'Launched LinkedIn Ads for [client] at $[X] per opportunity on $[Y] a month'],
      ['How are social pixels and the Conversions API set up on client sites, and on the agency’s own?', 'What creative volume does a typical account get a month?']),
    T('N16', 'Media Planner / Performance Strategist', 'N2', ['programmatic_ctv', 'paid_search', 'paid_social'], { junior: 'Media Coordinator', mid: 'Media Planner', senior: 'Performance Strategist', manager: 'Media Director', director: 'VP Media' },
      ['Planned', 'Allocated', 'Forecast', 'Negotiated', 'Measured', 'Reallocated', 'Scaled', 'Modeled', 'Presented', 'Delivered'],
      ['media planning', 'channel mix', 'programmatic', 'CTV', 'incrementality', 'marketing mix modeling', 'budget allocation', 'forecasting', 'media buying', 'measurement framework', 'first-party data', 'reporting'],
      '%ROLE% with %YEARS% planning media across channels and proving what each one adds. Strong in %SKILL1% and %SKILL2%; moves budget on incrementality, not last click.',
      ['Lead with the total budget planned, the channels, and the measured lift or efficiency.', 'Name the measurement framework (MMM, holdouts, incrementality) and the platforms.'],
      ['Planned $[X] a year across [channels] for [N] clients, lifting blended ROAS [Y]% through reallocation on incrementality tests', 'Built a measurement framework (MMM plus holdouts) that reallocated $[X] from [channel] to [channel]', 'Negotiated [N] CTV and programmatic deals at [X]% below rate card'],
      ['How does the agency decide channel mix for a client: last click, holdouts, modeling?', 'Which channels are automation absorbing, and what does the planner still own?']),
    T('N3', 'Creative Strategist', 'N3', ['creator_influencer', 'content_pr'], { junior: 'Copywriter', mid: 'Creative Strategist', senior: 'Senior Creative Strategist', manager: 'Creative Lead', director: 'Creative Director' },
      ['Concepted', 'Launched', 'Repositioned', 'Directed', 'Produced', 'Shipped', 'Won', 'Unified', 'Wrote', 'Delivered'],
      ['brand strategy', 'creative campaigns', 'copywriting', 'video production', 'design systems', 'messaging', 'launch planning', 'UGC', 'creative testing', 'brand guidelines', 'art direction', 'storytelling'],
      '%ROLE% with %YEARS% turning positioning into campaigns that move a number. Strong in %SKILL1% and %SKILL2%; produces the creative volume performance media now runs on.',
      ['Pair every campaign with its result: awareness lift, CTR, conversion, sales.', 'List the production you can do yourself (video, design, copy) and the tools.'],
      ['Launched [campaign] across [channels], lifting [metric] [X]% and winning [award or recognition]', 'Produced [N] creative variants a month for paid social, raising CTR [X]% and cutting CPA [Y]%', 'Repositioned [brand] with new messaging and a design system shipped across [N] properties'],
      ['How much creative does a performance account need a month, and who produces it?', 'How are creative results fed back into planning?']),
    T('N4', 'Web Producer / UX', 'N4', ['web_dev'], { junior: 'Web Coordinator', mid: 'Web Producer', senior: 'Senior Web Producer', manager: 'Web Team Lead', director: 'Head of Web' },
      ['Shipped', 'Migrated', 'Rebuilt', 'Launched', 'Automated', 'Integrated', 'Reduced', 'Designed', 'Tested', 'Scaled'],
      ['WordPress', 'Webflow', 'Shopify', 'headless CMS', 'site migrations', 'Core Web Vitals', 'accessibility (WCAG)', 'UX research', 'landing pages', 'QA', 'information architecture', 'site ownership'],
      '%ROLE% with %YEARS% shipping sites and landing pages that load fast, convert and belong to the client. Strong in %SKILL1% and %SKILL2%; owns the build from brief to launch.',
      ['Quantify builds: pages shipped, speed scores, conversion lift, launch dates met.', 'Name the platforms (WordPress, Webflow, Shopify, headless) and the migrations you ran with traffic retained.'],
      ['Shipped [N] sites on [platform] in [period], each at [LCP] seconds and WCAG [level], on time and on budget', 'Migrated [N] sites off a proprietary CMS to [platform] with [X]% of traffic retained', 'Cut average page load from [A] to [B] seconds across [N] client sites'],
      ['Do clients own their websites and content when they leave?', 'What platform does the agency build on, and what does a migration in or out look like?']),
    T('N17', 'CRO / Experimentation Manager', 'N4', ['cro'], { junior: 'CRO Specialist', mid: 'CRO Manager', senior: 'Senior Experimentation Manager', manager: 'Experimentation Lead', director: 'Head of Optimization' },
      ['Tested', 'Lifted', 'Designed', 'Analyzed', 'Prioritized', 'Launched', 'Validated', 'Scaled', 'Instrumented', 'Reduced'],
      ['A/B testing', 'experimentation program', 'VWO', 'Optimizely', 'conversion rate optimization', 'landing pages', 'user research', 'heatmaps', 'statistical significance', 'test velocity', 'win rate', 'GA4 experiments'],
      '%ROLE% with %YEARS% running experimentation programs with measured lift. Strong in %SKILL1% and %SKILL2%; ships tests on a cadence and reports wins and losses alike.',
      ['Lead with test velocity, win rate and the conversion lift in dollars.', 'Name the testing tools you ran: the house test agencies fail most is a CRO line with no tool on their own site.'],
      ['Ran [N] A/B tests a quarter in [tool] with a [X]% win rate, lifting conversion rate from [A]% to [B]% on [pages]', 'Built an experimentation program for [N] clients: hypotheses backlog, prioritization, [X] tests a month', 'Lifted landing page conversion [X]% for [client type] through [what you changed]'],
      ['What testing tool runs on the agency’s own site, and what is the test velocity for clients?', 'How are losing tests reported?']),
    T('N5', 'Marketing Analyst / Measurement Lead', 'N5', ['data_measurement'], { junior: 'Marketing Analyst', mid: 'Marketing Analytics Manager', senior: 'Senior Analytics Manager', manager: 'Analytics & Measurement Lead', director: 'Head of Data & Measurement' },
      ['Instrumented', 'Modeled', 'Attributed', 'Reconciled', 'Automated', 'Validated', 'Forecast', 'Built', 'Governed', 'Quantified'],
      ['GA4', 'Google Tag Manager', 'server-side tagging', 'Conversions API', 'attribution', 'marketing mix modeling', 'incrementality', 'Looker Studio', 'BigQuery', 'SQL', 'consent mode', 'first-party data'],
      '%ROLE% with %YEARS% making marketing measurable when the platforms hide the numbers. Strong in %SKILL1% and %SKILL2%; builds the first-party data and governance automated buying runs on.',
      ['Quantify what measurement unlocked: reallocated budget, recovered conversions, decisions changed.', 'Name the stack explicitly (GA4, GTM, server-side, BigQuery, SQL, Looker Studio): ATS filters key on it.'],
      ['Instrumented GA4, server-side tagging and Conversions API for [N] accounts, recovering [X]% of conversions lost to consent and browser limits', 'Built a marketing mix model that reallocated $[X] and lifted blended ROAS [Y]%', 'Automated [N] client dashboards in Looker Studio on BigQuery, saving [X] hours a week'],
      ['How is attribution handled now that platforms hide more of the data?', 'What first-party data pipelines do clients have in place?']),
    T('N6', 'Email & Lifecycle / CRM Manager', 'N6', ['email_crm'], { junior: 'Email Marketing Specialist', mid: 'Lifecycle Marketing Manager', senior: 'Senior CRM Manager', manager: 'CRM & Lifecycle Lead', director: 'Head of CRM' },
      ['Grew', 'Retained', 'Segmented', 'Automated', 'Lifted', 'Designed', 'Launched', 'Reactivated', 'Personalized', 'Reduced'],
      ['email marketing', 'lifecycle marketing', 'HubSpot', 'Klaviyo', 'Salesforce Marketing Cloud', 'segmentation', 'marketing automation', 'retention', 'loyalty', 'deliverability', 'SMS', 'customer data platform'],
      '%ROLE% with %YEARS% growing owned audiences and the revenue they return. Strong in %SKILL1% and %SKILL2%; builds the lifecycle programs that hedge against rented discovery.',
      ['Lead with list growth, email revenue share, retention and reactivation numbers.', 'Name the platforms (HubSpot, Klaviyo, Salesforce, Braze) and deliverability results.'],
      ['Grew an email list from [A] to [B] subscribers and lifted email revenue share to [X]% of total', 'Built [N] lifecycle automations in [platform] that reactivated [X]% of lapsed customers', 'Raised deliverability to [X]% inbox placement and cut unsubscribes [Y]%'],
      ['Which clients have owned-audience programs, and who runs them?', 'What is the agency’s own email program?']),
    T('N7', 'Ecommerce & Marketplace Manager', 'N7', ['retail_media'], { junior: 'Marketplace Specialist', mid: 'Ecommerce Marketing Manager', senior: 'Senior Marketplace Manager', manager: 'Retail Media Lead', director: 'Head of Commerce' },
      ['Grew', 'Optimized', 'Launched', 'Scaled', 'Structured', 'Managed', 'Lifted', 'Expanded', 'Cleaned', 'Automated'],
      ['Amazon Ads', 'retail media', 'Merchant Center', 'product feeds', 'Shopping campaigns', 'marketplace growth', 'catalog optimization', 'feed management', 'ecommerce revenue', 'ACoS', 'ROAS', 'agentic commerce'],
      '%ROLE% with %YEARS% growing revenue on marketplaces and retail media. Strong in %SKILL1% and %SKILL2%; keeps the feeds and catalog data clean enough for answer engines and agents to sell from.',
      ['Lead with marketplace revenue, ACoS or ROAS and feed quality numbers.', 'Name Merchant Center, Amazon Ads and the feed tools you ran.'],
      ['Grew marketplace revenue [X]% ($[A] to $[B]) at [ACoS or ROAS] through [what]', 'Cleaned and enriched product feeds for [N] SKUs, lifting Shopping impressions [X]% and cutting disapprovals [Y]%', 'Launched retail media on [network] at $[X] a month returning [Y] ROAS'],
      ['Who owns feeds and product data for clients: the agency or the client?', 'Which retail media networks does the agency buy on?']),
    T('N8', 'Social & Creator Manager', 'N8', ['creator_influencer'], { junior: 'Social Media Coordinator', mid: 'Social Media Manager', senior: 'Senior Social Manager', manager: 'Social & Creator Lead', director: 'Head of Social' },
      ['Grew', 'Produced', 'Launched', 'Managed', 'Negotiated', 'Scaled', 'Engaged', 'Scripted', 'Measured', 'Built'],
      ['organic social', 'short-form video', 'creator partnerships', 'influencer programs', 'community management', 'UGC', 'TikTok', 'Instagram', 'LinkedIn', 'content calendar', 'social listening', 'brand voice'],
      '%ROLE% with %YEARS% building audiences and creator programs that platforms reward. Strong in %SKILL1% and %SKILL2%; supplies the human-provenance content answer engines cite.',
      ['Quantify followers, reach, engagement rate, creator ROI and content volume.', 'Name the platforms and the tools (scheduling, listening, creator management).'],
      ['Grew [platform] from [A] to [B] followers in [months] with [N] posts a week at [X]% engagement', 'Ran a creator program of [N] creators returning [X] ROAS on $[Y]', 'Produced [N] short-form videos a month that drove [X] site visits and [Y] leads'],
      ['How does the agency measure organic social and creator work against revenue?', 'Which clients run community programs?']),
    T('N9', 'AI Search / GEO Specialist', 'N9', ['ai_search', 'ai_automation'], { junior: 'AI Visibility Analyst', mid: 'AI Search / GEO Specialist', senior: 'Senior GEO Strategist', manager: 'AI Search Lead', director: 'Head of AI Search' },
      ['Published', 'Instrumented', 'Automated', 'Tracked', 'Lifted', 'Built', 'Piloted', 'Structured', 'Audited', 'Trained'],
      ['AI search visibility', 'generative engine optimization', 'llms.txt', 'structured data', 'entity optimization', 'citation tracking', 'ChatGPT', 'Gemini', 'Perplexity', 'AI Overviews', 'LLM workflows', 'marketing automation'],
      '%ROLE% with %YEARS% making brands visible inside AI answers and automating the work around them. Strong in %SKILL1% and %SKILL2%; measures citations, not just rankings.',
      ['Show the AI visibility work as a product: what you tracked, how often, what moved.', 'Name the assistants (ChatGPT, Gemini, AI Overviews, Perplexity, Claude) and the automation tools.'],
      ['Published llms.txt, schema and entity pages for [N] client sites and lifted AI citation share from [X]% to [Y]% in [months]', 'Built a monthly AI visibility scorecard tracking citation and mention share across [assistants] for [N] money queries', 'Automated [workflow] with [tool or agents], saving [X] hours a month at [quality metric]'],
      ['How do you report AI visibility to clients today: citations, mentions, share of answer?', 'Does the agency publish llms.txt and structured data on its own site?']),
    T('N10', 'Local SEO / LSA Specialist', 'N10', ['local'], { junior: 'Local SEO Specialist', mid: 'Local SEO Manager', senior: 'Senior Local Marketing Manager', manager: 'Local & Lead Generation Lead', director: 'Head of Local' },
      ['Ranked', 'Generated', 'Booked', 'Grew', 'Cut', 'Tracked', 'Verified', 'Audited', 'Scaled', 'Won'],
      ['Google Business Profile', 'local SEO', 'Local Services Ads', 'map pack', 'call tracking', 'lead quality', 'multi-location', 'reviews', 'citations', 'franchise marketing', 'intake', 'cost per lead'],
      '%ROLE% with %YEARS% turning local search into booked jobs and signed cases. Strong in %SKILL1% and %SKILL2%; runs Business Profiles, Local Services Ads and call tracking as one system.',
      ['Lead with leads, calls, bookings and cost per lead by location.', 'Name LSAs, Business Profile, call tracking (CallRail) and review tools explicitly.'],
      ['Grew map-pack visibility for [N] locations, lifting calls [X]% and booked jobs [Y]%', 'Managed Local Services Ads for [N] locations: disputed [X]% of bad leads, won $[Y] in credits, booked [Z] jobs a month', 'Cut cost per lead from $[A] to $[B] across [N] markets'],
      ['How do you measure lead quality and handle disputed Local Services Ads leads?', 'How is call tracking kept consistent with the Business Profile number?']),
    T('N11', 'B2B Demand Gen / ABM Manager', 'N11', ['b2b_abm'], { junior: 'Demand Generation Specialist', mid: 'Demand Generation Manager', senior: 'Senior ABM Manager', manager: 'Demand Generation Lead', director: 'Head of Demand Generation' },
      ['Sourced', 'Grew', 'Launched', 'Scaled', 'Qualified', 'Aligned', 'Built', 'Converted', 'Accelerated', 'Reported'],
      ['account-based marketing', 'demand generation', 'LinkedIn Ads', 'pipeline', 'MQL to SQL', 'HubSpot', 'Salesforce', '6sense', 'sales enablement', 'intent data', 'lead scoring', 'webinars'],
      '%ROLE% with %YEARS% sourcing pipeline, not just leads. Strong in %SKILL1% and %SKILL2%; runs ABM and LinkedIn programs with sales in the room.',
      ['Lead with pipeline sourced, cost per opportunity and win rate influence.', 'Name the stack (HubSpot, Salesforce, 6sense, LinkedIn Ads): common ATS filters.'],
      ['Launched LinkedIn Ads and ABM programs reaching [N] target accounts and sourcing $[X] in pipeline at $[Y] per opportunity', 'Built lead scoring in [platform] that lifted MQL-to-SQL conversion from [A]% to [B]%', 'Ran [N] webinars a quarter producing [X] opportunities'],
      ['How is pipeline attributed to marketing, and who signs off on it?', 'Does the agency run LinkedIn Ads for itself?']),
    T('N12', 'Content Strategist / Digital PR', 'N12', ['content_pr'], { junior: 'Content Writer', mid: 'Content Strategist', senior: 'Senior Content Strategist', manager: 'Editorial Lead', director: 'Head of Content & PR' },
      ['Published', 'Earned', 'Pitched', 'Edited', 'Grew', 'Placed', 'Produced', 'Led', 'Researched', 'Repurposed'],
      ['digital PR', 'earned media', 'thought leadership', 'editorial calendar', 'content strategy', 'link acquisition', 'reputation management', 'reviews', 'press', 'E-E-A-T', 'copywriting', 'case studies'],
      '%ROLE% with %YEARS% producing the content and earned mentions that search engines rank and answer engines cite. Strong in %SKILL1% and %SKILL2%; runs an editorial engine on a cadence.',
      ['Quantify placements, referring domains, cadence and the traffic or leads the content produced.', 'Show case studies you wrote: thin proof is the weakness most agencies carry.'],
      ['Rebuilt an editorial calendar to [N] pieces a month and grew organic sessions [X]% in [months]', 'Earned [N] placements in [publications] worth [X] referring domains', 'Wrote [N] case studies with audited results that supported $[X] in new business'],
      ['What is the content cadence plan for the agency and for clients?', 'Who writes case studies, and how are results audited before they are published?']),
    T('N13', 'Account Manager / Client Services', null, [], { junior: 'Account Coordinator', mid: 'Account Manager', senior: 'Senior Account Manager', manager: 'Account Director', director: 'Head of Client Services' },
      ['Retained', 'Renewed', 'Grew', 'Resolved', 'Led', 'Presented', 'Negotiated', 'Expanded', 'Delivered', 'Reduced'],
      ['client retention', 'account management', 'quarterly business reviews', 'upsell', 'churn reduction', 'reporting', 'stakeholder management', 'scope management', 'renewals', 'NPS', 'onboarding', 'outcome-based reporting'],
      '%ROLE% with %YEARS% keeping agency clients renewed, growing and able to see their return. Strong in %SKILL1% and %SKILL2%; the account lead clients stay for.',
      ['Lead with retention rate, book size, net revenue retention and churn reduced.', 'Show transparent reporting and outcome pricing you ran: it is what burned clients look for.'],
      ['Retained [X]% of a $[Y] book across [N] accounts and grew net revenue retention to [Z]%', 'Cut churn from [A]% to [B]% by [onboarding, reporting or scope change]', 'Moved [N] accounts to outcome-based reporting on [metric], renewing [X]% of them'],
      ['What is client retention over twelve months, and what does the first ninety days look like?', 'How do clients see their results: a dashboard, a monthly call, a report?']),
    T('N14', 'Delivery / Operations Lead', null, [], { junior: 'Project Coordinator', mid: 'Project Manager', senior: 'Senior Delivery Manager', manager: 'Head of Delivery', director: 'Operations Director' },
      ['Standardized', 'Onshored', 'Reduced', 'Streamlined', 'Managed', 'Audited', 'Built', 'Scaled', 'Cut', 'Trained'],
      ['delivery operations', 'quality assurance', 'vendor management', 'SOPs', 'resource planning', 'utilization', 'margin', 'process automation', 'white-label partners', 'training', 'AI-assisted workflows', 'capacity planning'],
      '%ROLE% with %YEARS% running agency delivery at margin without losing quality. Strong in %SKILL1% and %SKILL2%; builds the review layer offshore and AI production need.',
      ['Quantify margin, utilization, turnaround time, revision rates and QA catch rates.', 'Name the systems (project management, QA, vendor and white-label partners) and the teams you trained.'],
      ['Raised delivery margin from [A]% to [B]% by [standardizing, onshoring QA or automating] across [N] accounts', 'Built a QA layer over [offshore or AI] production that cut revisions [X]% and client escalations [Y]%', 'Trained [N] juniors on AI-assisted workflows with review standards, raising output [X]%'],
      ['What is the delivery model for the hours-heavy lines: in house, partners, offshore, AI?', 'How are juniors trained, and what does review look like?']),
  ];
  const TRACK = Object.create(null); TRACKS.forEach(t => { TRACK[t.code] = t; });
  E.TRACKS = TRACKS; E.TRACK = TRACK;

  /* ---------- Clapback's industry profiles: the general tracks, for a résumé with no agency in mind ---------- */
  const IND = (id, label, sections, verbs, keywords, summary, notes) => { const base = label.split(' / ')[0].split(' (')[0]; return { id, label, sections, verbs, keywords, summary, notes, titles: { junior: base + ' Coordinator', mid: base + ' Specialist', senior: 'Senior ' + base + ' Specialist', manager: base + ' Manager', director: base + ' Director' }, starters: ['Improved [metric] [X]% by [what you did] for [who]', 'Led [N] [projects or accounts] delivering [result] on time', 'Reduced [cost or time] [X]% through [process or tool]'], asks: [] }; };
  const INDUSTRIES = [
    IND('marketing', 'Marketing / SEO', ['Summary', 'Skills', 'Experience', 'Results', 'Education'], ['Grew', 'Launched', 'Ranked', 'Optimized', 'Tested', 'Scaled', 'Positioned', 'Converted', 'Automated', 'Analyzed'], ['SEO', 'content strategy', 'PPC', 'analytics (GA4)', 'conversion rate', 'email', 'A/B testing', 'keyword research', 'CRO', 'campaign management'], '%ROLE% with %YEARS% driving measurable growth through %SKILL1% and %SKILL2%. Data-led, with the results to show for it.', ['Lead every bullet with a number: traffic, rankings, CAC, ROAS, conversion lift.', 'Mirror the posting’s channel keywords (SEO vs. paid vs. lifecycle) in your skills block.']),
    IND('software', 'Software / Engineering', ['Summary', 'Technical skills', 'Experience', 'Projects', 'Education'], ['Built', 'Shipped', 'Designed', 'Architected', 'Automated', 'Optimized', 'Migrated', 'Debugged', 'Scaled', 'Led'], ['APIs', 'CI/CD', 'unit testing', 'cloud (AWS/GCP/Azure)', 'Git', 'REST', 'SQL', 'code review', 'Agile', 'microservices'], '%ROLE% with %YEARS% building and shipping reliable software. Strengths in %SKILL1% and %SKILL2%; comfortable owning features end to end.', ['Lead bullets with a verb + what you built + measurable impact (latency, uptime, users, cost).', 'List languages/frameworks in a scannable skills block near the top; ATS keyword-matches against it.']),
    IND('data', 'Data / Analytics', ['Summary', 'Technical skills', 'Experience', 'Projects', 'Education'], ['Analyzed', 'Modeled', 'Forecasted', 'Automated', 'Visualized', 'Cleaned', 'Segmented', 'Quantified', 'Reported', 'Validated'], ['SQL', 'Python', 'dashboards', 'A/B testing', 'ETL', 'statistics', 'Tableau/Power BI', 'data modeling', 'KPIs', 'experimentation'], '%ROLE% turning messy data into decisions. Depth in %SKILL1% and %SKILL2%; translates analysis into plain-English recommendations.', ['Quantify outcomes: % lift, $ saved, hours automated, decisions influenced.', 'Name the tools explicitly; ATS filters often key on SQL, Python, specific BI tools.']),
    IND('sales', 'Sales / Business development', ['Summary', 'Highlights', 'Experience', 'Skills', 'Education'], ['Closed', 'Exceeded', 'Prospected', 'Negotiated', 'Expanded', 'Built', 'Retained', 'Grew', 'Won', 'Forecasted'], ['quota attainment', 'pipeline', 'CRM (Salesforce/HubSpot)', 'prospecting', 'negotiation', 'account management', 'closing', 'SaaS', 'territory', 'forecasting'], '%ROLE% with %YEARS% consistently beating quota. Strong in %SKILL1% and %SKILL2%; builds pipeline and closes.', ['Open with quota % attainment, revenue closed, and ranking (e.g., top 5%).', 'Numbers first, every line: $, %, deal count, ramp time.']),
    IND('customer', 'Customer service / Support', ['Summary', 'Skills', 'Experience', 'Education'], ['Resolved', 'Supported', 'Improved', 'Handled', 'De-escalated', 'Retained', 'Trained', 'Documented', 'Exceeded', 'Streamlined'], ['CSAT', 'ticketing (Zendesk)', 'SLA', 'de-escalation', 'troubleshooting', 'onboarding', 'retention', 'phone/email/chat', 'knowledge base', 'first-contact resolution'], '%ROLE% with %YEARS% keeping customers happy and retained. Strong in %SKILL1% and %SKILL2%; calm under volume.', ['Lead with CSAT, resolution time, ticket volume, and retention numbers.', 'Name the support tools you know; common ATS filters.']),
    IND('pm', 'Project / Program management', ['Summary', 'Skills', 'Experience', 'Certifications', 'Education'], ['Delivered', 'Coordinated', 'Scheduled', 'Budgeted', 'Managed', 'Reduced', 'Oversaw', 'Negotiated', 'Resolved', 'Planned'], ['scheduling', 'budget management', 'stakeholder communication', 'risk management', 'Asana / Jira', 'vendors', 'scope', 'on-time delivery', 'procurement', 'PMP'], '%ROLE% with %YEARS% delivering projects on time and on budget. Strong in %SKILL1% and %SKILL2%; keeps stakeholders aligned.', ['Lead with budget size, timeline, team size, and on-time/under-budget results.', 'Name your PM tools and certifications (PMP, Scrum) explicitly.']),
    IND('finance', 'Finance / Accounting', ['Summary', 'Skills', 'Experience', 'Certifications', 'Education'], ['Reconciled', 'Forecasted', 'Audited', 'Analyzed', 'Reduced', 'Budgeted', 'Modeled', 'Reported', 'Streamlined', 'Advised'], ['GAAP', 'financial modeling', 'forecasting', 'reconciliation', 'Excel', 'audit', 'AP/AR', 'variance analysis', 'ERP (NetSuite/SAP)', 'close process'], '%ROLE% with %YEARS% owning accurate numbers and clear reporting. Strong in %SKILL1% and %SKILL2%; built for tight closes and clean audits.', ['Show $ scale (budgets, portfolios, savings) and cycle times (close in X days).', 'Name certifications (CPA, CFA) and ERP systems; both are common ATS filters.']),
    IND('legal', 'Legal', ['Summary', 'Bar admissions', 'Experience', 'Skills', 'Education'], ['Drafted', 'Negotiated', 'Advised', 'Researched', 'Litigated', 'Reviewed', 'Filed', 'Managed', 'Resolved', 'Counseled'], ['legal research', 'contract drafting', 'due diligence', 'compliance', 'litigation', 'discovery', 'regulatory', 'Westlaw/Lexis', 'negotiation', 'case management'], '%ROLE% with %YEARS% across %SKILL1% and %SKILL2%. Precise drafter and pragmatic advisor who moves matters to resolution.', ['List bar admissions and jurisdictions clearly near the top.', 'Quantify matters (caseload, deal size, outcomes) where confidentiality allows.']),
    IND('healthcare', 'Healthcare / Nursing', ['Summary', 'Licenses & certifications', 'Experience', 'Skills', 'Education'], ['Assessed', 'Administered', 'Coordinated', 'Monitored', 'Educated', 'Documented', 'Triaged', 'Advocated', 'Collaborated', 'Stabilized'], ['patient care', 'EHR/EMR', 'HIPAA', 'BLS/ACLS', 'care plans', 'medication administration', 'charting', 'vitals', 'interdisciplinary team', 'patient education'], '%ROLE% with %YEARS% delivering safe, patient-centered care. Skilled in %SKILL1% and %SKILL2%; calm and precise under pressure.', ['Put licenses/certs high and exact (RN, license #, state, BLS/ACLS with dates).', 'Lead with patient volume, unit/setting, and safety or outcome metrics.']),
    IND('trades', 'Skilled trades (HVAC / Plumbing / Electrical)', ['Summary', 'Licenses & certifications', 'Experience', 'Skills', 'Education'], ['Installed', 'Repaired', 'Diagnosed', 'Maintained', 'Inspected', 'Serviced', 'Retrofitted', 'Troubleshot', 'Certified', 'Completed'], ['licensed', 'EPA 608', 'installation', 'preventive maintenance', 'troubleshooting', 'code compliance', 'service calls', 'safety (OSHA)', 'blueprints', 'estimates'], '%ROLE% with %YEARS% of hands-on %SKILL1% and %SKILL2%. Licensed, safety-first, and reliable on every call.', ['Put license type/number, state, and certifications (EPA 608, OSHA) up top.', 'Quantify: jobs/day, first-time-fix rate, callback rate, systems serviced.']),
    IND('education', 'Education / Teaching', ['Summary', 'Certifications', 'Experience', 'Skills', 'Education'], ['Taught', 'Designed', 'Improved', 'Mentored', 'Assessed', 'Differentiated', 'Led', 'Collaborated', 'Integrated', 'Raised'], ['curriculum design', 'classroom management', 'assessment', 'differentiated instruction', 'IEP', 'student outcomes', 'EdTech', 'lesson planning', 'parent communication', 'state standards'], '%ROLE% with %YEARS% raising student outcomes through %SKILL1% and %SKILL2%. Inclusive, organized, and data-informed.', ['Put certification/licensure and grade/subject bands near the top.', 'Quantify outcomes: score gains, pass rates, students served.']),
    IND('general', 'General / Other', ['Summary', 'Skills', 'Experience', 'Education'], ['Improved', 'Led', 'Built', 'Managed', 'Created', 'Streamlined', 'Increased', 'Reduced', 'Delivered', 'Coordinated'], ['communication', 'problem-solving', 'project coordination', 'leadership', 'process improvement', 'reporting', 'collaboration', 'time management', 'analysis', 'organization'], '%ROLE% with %YEARS% and a track record in %SKILL1% and %SKILL2%. Reliable, organized, and outcome-focused.', ['Every bullet: verb + what you did + result (number wherever possible).', 'Read the posting and echo its exact skill words in your skills block.']),
  ];
  const INDUSTRY = Object.create(null); INDUSTRIES.forEach(i => { INDUSTRY[i.id] = i; });
  E.INDUSTRIES = INDUSTRIES; E.INDUSTRY = INDUSTRY;
  E.profile = code => TRACK[code] || INDUSTRY[code] || INDUSTRY.marketing;
  E.titleFor = function (code, level) { const p = E.profile(code); const t = p.titles || {}; return t[level] || t.mid || p.label; };
  E.isAlias = function (role, code) { const p = E.profile(code); const r = String(role || '').trim().toLowerCase(); if (!r) return false; return Object.values(p.titles || {}).some(t => t.toLowerCase() === r) || r.includes(p.label.toLowerCase().split(' / ')[0]); };
  E.levelFromYears = function (years) { const m = String(years || '').match(/(\d+)/); if (!m) return 'mid'; const y = Number(m[1]); return y < 2 ? 'junior' : y < 5 ? 'mid' : y < 9 ? 'senior' : 'manager'; };

  /* ---------- the rules: what a finding means for a hire ---------- */
  const GAP = {
    ai_no_llms: { need: 'an AI search practitioner who ships llms.txt, structured data and citation tracking on the agency’s own site before selling it', move: 'Lead with AI search visibility work you can show: llms.txt, schema and entity pages, citation share inside ChatGPT, Gemini, AI Overviews and Perplexity.', pitch: 'stand up an audited AI search visibility practice', tracks: ['N9', 'N1'], starter: TRACK.N9.starters[0], ask: 'Does the agency publish llms.txt and structured data on its own site, and who owns that?' },
    social_no_pixel: { need: 'a paid social lead who instruments the house first: pixels, Conversions API and consent mode', move: 'Put measurement instrumentation (Meta Pixel, Conversions API, consent mode, server-side tagging) in your skills block and in one bullet with a match-rate or CPA number.', pitch: 'run paid social on properly instrumented measurement', tracks: ['N15', 'N5'], starter: TRACK.N15.starters[1], ask: 'How are social pixels and the Conversions API set up on client sites, and on the agency’s own?' },
    no_linkedin_ads: { need: 'a B2B demand operator who runs LinkedIn Ads in house and can show pipeline from it', move: 'Show LinkedIn Ads programs with pipeline and cost per opportunity, and name the ABM stack you ran.', pitch: 'build LinkedIn-led demand generation with pipeline proof', tracks: ['N11', 'N15'], starter: TRACK.N11.starters[0], ask: 'Does the agency run LinkedIn Ads for itself, and how is B2B pipeline attributed?' },
    search_no_ads: { need: 'a paid search lead who runs the agency’s own Google Ads and treats the house account as the portfolio', move: 'Lead with Google Ads accounts you built and the results, in the metrics the agency sells (cost per signed case, booked job, lead).', pitch: 'run paid search that shows in the Transparency Center', tracks: ['N2', 'N10'], starter: TRACK.N2.starters[0], ask: 'Who runs the agency’s own Google Ads, and how is that account used in sales?' },
    cro_no_testing: { need: 'a CRO lead who stands up an experimentation program: tooling, hypotheses, test velocity', move: 'Name the testing tools you ran (VWO, Optimizely, GA4 experiments), your test velocity and a win rate.', pitch: 'run an experimentation program with measured lift', tracks: ['N17', 'N4'], starter: TRACK.N17.starters[0], ask: 'What testing tool runs on the agency’s own site, and what is the test velocity for clients?' },
    content_stalled: { need: 'an editorial lead to restart the publishing cadence and tie it to search and AI citations', move: 'Show cadence and system: posts per month, an editorial calendar, repurposing, and the traffic or citations it produced.', pitch: 'restart an editorial engine that earns search and AI citations', tracks: ['N12', 'N1'], starter: TRACK.N12.starters[0], ask: 'What is the content cadence plan for the agency’s own site?' },
    ai_blocks_bots: { need: 'a technical SEO who sets AI crawler policy on purpose and reconciles it with what the agency sells', move: 'Mention robots.txt and AI crawler policy (GPTBot, ClaudeBot, Google-Extended) and llms.txt as deliberate choices with results.', pitch: 'set crawler and AI visibility policy deliberately', tracks: ['N1', 'N9'], starter: 'Audited AI crawler access and robots policy for [N] sites and restored citations in [assistants] within [weeks]', ask: 'Which AI crawlers does the agency block on its own site, and why?' },
  };
  const MOVE = {
    P1: { tracks: ['N9', 'N5'], need: 'an audited AI visibility product: citation and mention share by money query, tracked monthly', move: 'Show AI visibility tracking you have run: tools, scorecards, citation share tied to branded search or direct traffic.', pitch: 'productise AI visibility as an audited service', starter: TRACK.N9.starters[1], ask: 'How do you report AI visibility to clients today?' },
    P2: { tracks: ['N1', 'N7', 'N10'], need: 'feeds, entities and schema as a service line: Merchant Center, Business Profile data, review operations', move: 'Name feed, schema and entity work: Merchant Center, product attributes, Business Profile data, review velocity.', pitch: 'make feeds, entities and schema a service line', starter: 'Cleaned product feeds and entity data for [N] locations, lifting Shopping impressions [X]% and map-pack visibility [Y]%', ask: 'Who owns schema, feeds and Business Profile data for clients?' },
    P3: { tracks: ['N10'], need: 'Local Services Ads and Sponsored Places run as core local work: lead quality audits, disputes, call tracking integrity', move: 'Put LSA management in your skills block with lead quality, dispute and credit handling, and call tracking numbers.', pitch: 'run Local Services Ads as core local work', starter: TRACK.N10.starters[1], ask: 'How do you measure lead quality and handle disputed Local Services Ads leads?' },
    P4: { tracks: ['N5', 'N16', 'N3'], need: 'the inputs automation runs on: human-reviewed creative volume, first-party data pipelines, offer testing', move: 'Show first-party data pipelines (Customer Match, conversions APIs), creative volume for Performance Max and Advantage+, and offer tests.', pitch: 'supply the first-party data and creative volume automation consumes', starter: 'Built first-party data pipelines (Customer Match, Conversions API) feeding Performance Max and Advantage+, lifting ROAS [X]%', ask: 'What first-party data and creative volume do accounts feed into automated buying?' },
    P5: { tracks: ['N13', 'N14'], need: 'pricing and reporting on outputs and outcomes rather than hours', move: 'Show outcome-based reporting and pricing you have sold or delivered: cost per signed case, booked job, revenue share.', pitch: 'report and price on outcomes', starter: TRACK.N13.starters[2], ask: 'How are engagements priced: hours, retainers, outcomes?' },
    P6: { tracks: ['N14', 'N9'], need: 'retraining juniors into agent operators: AI plus a reviewer as the execution layer', move: 'Show how you trained a team on AI workflows and review standards, and what it did to throughput and quality.', pitch: 'train a team into AI-assisted operators', starter: TRACK.N14.starters[2], ask: 'How are juniors trained on AI-assisted work, and what does review look like?' },
    P7: { tracks: ['N6', 'N8'], need: 'owned-audience hedges: email, community and lists for the agency and its clients', move: 'Show list growth, email revenue share, community size and engagement.', pitch: 'build owned audiences as a hedge against enclosed discovery', starter: TRACK.N6.starters[0], ask: 'What owned-audience programs run for the agency and for clients?' },
    P8: { tracks: ['N2', 'N9'], need: 'tests of ads inside AI assistants with incrementality holdouts', move: 'Name any ChatGPT ads, AI Mode ads or assistant placement tests you ran, and the holdout design.', pitch: 'test ads inside AI assistants with holdouts', starter: 'Piloted ads inside [assistant] with a [X]% geo holdout and measured [Y] incremental conversions', ask: 'Has the agency tested ads inside AI assistants, and with what holdouts?' },
  };
  const HB_THEME = {
    retention: { tracks: ['N13'], need: 'account leads who keep clients: transparent reporting, honest scope, renewals', move: 'Lead with retention, renewal and churn numbers; show transparent reporting.', pitch: 'keep clients renewed with transparent reporting', starter: TRACK.N13.starters[1], ask: 'What is client retention over twelve months, and how is billing made clear?', label: 'client retention and transparent reporting' },
    'site-ownership': { tracks: ['N4'], need: 'web producers who build on platforms clients own and can migrate cleanly', move: 'Name the open platforms you build on and migrations you ran with traffic retained.', pitch: 'build sites clients own and migrate them without loss', starter: TRACK.N4.starters[1], ask: 'Do clients own their websites and content when they leave?', label: 'site ownership and clean migrations' },
    'production-quality': { tracks: ['N14', 'N12'], need: 'onshore craft and a review layer over outsourced or AI production', move: 'Show hands-on craft and QA over outsourced or AI output: revision rates, quality scores.', pitch: 'put human craft and review over outsourced production', starter: TRACK.N14.starters[1], ask: 'What is the delivery model, and who reviews outsourced or AI-produced work?', label: 'production quality and review' },
    'lead-quality': { tracks: ['N10', 'N5'], need: 'lead quality and call tracking integrity: verified leads, disputes, honest counts', move: 'Show lead verification, call tracking and dispute handling with numbers.', pitch: 'deliver verified leads with honest counts', starter: 'Verified lead quality for [N] accounts with call tracking and disputes, raising qualified-lead share from [A]% to [B]%', ask: 'How are leads verified and counted, and how are disputed leads handled?', label: 'lead quality assurance' },
  };
  E.GAP = GAP; E.MOVE = MOVE; E.HB_THEME = HB_THEME;
  const SEV_LABEL = { 3: 'Gap', 2: 'Exposure', 1: 'Signal', 0: 'Strength' };
  E.SEV_LABEL = SEV_LABEL;
  const pct = v => (v == null ? null : Math.round(v * 100));
  const ord = n => { n = Math.round(n); const v = n % 100; return n + (v >= 11 && v <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th'); };
  E.ord = ord;
  function kjTitle(id) { const f = E.findings(); const k = f && (f.kj || []).find(x => x.id === id); return k ? k.title : id; }
  function implOf(id) { const f = E.findings(); return (f && (f.implications || []).find(x => x.id === id)) || null; }
  function needLabel(code) { const f = E.findings(); const t = f && f.taxonomy && f.taxonomy[code]; return t ? t.label : code; }
  E.needLabel = needLabel; E.kjTitle = kjTitle; E.implOf = implOf;
  /* a finding's weight rises with its rarity in the field: a move 76% of agencies have not made says little about this one */
  function rarity(rate) { if (typeof rate !== 'number') return 1; return Math.max(0.15, Math.min(1, 1 - rate)); }
  function moveRate(p, s) { const f = E.findings(); const m = f && f.field && f.field.moves && f.field.moves[p]; return m && typeof m[s] === 'number' ? m[s] : null; }
  function gapRate(code) { const f = E.findings(); const g = f && f.field && f.field.gapRates; return g && typeof g[code] === 'number' ? g[code] : null; }
  E.rarity = rarity;

  E.verticals = function (a) {
    const out = [];
    const wv = (a && a.wv) || {};
    for (const k of VERT_ORDER) if (wv[k] && VERT[k]) out.push({ key: k, label: VERT[k].label, wing: VERT[k].wing, mod: VERT[k].mod, names: wv[k].slice(0, 6) });
    return out.filter(v => v.mod || !out.some(o => o.mod && o.wing === v.wing));
  };

  /* ---------- read an agency: the gaps it shows, what it sells, ranked tracks, vocabulary ---------- */
  E.read = function (a) {
    const items = [];
    const push = x => { x.sev = x.sev == null ? 1 : x.sev; x.tracks = Array.from(new Set(x.tracks || [])); x.w = x.w == null ? x.sev : x.w; x.group = x.group || (x.sev >= 2 ? 'gap' : 'sell'); x.cls = x.cls || 'inferred'; items.push(x); return x; };
    if (!a) return { agency: null, items, tracks: rankTracks(items, null), vocab: [], verticals: [], thin: true, thinWhy: 'no agency chosen', brief: null };
    const dossier = '#core.a.' + a.id;
    const strat = a.strat || {};
    const f = E.findings() || {};
    for (const g of a.gaps || []) {
      const r = GAP[g.code] || { need: 'someone who closes the contradiction between what it sells and what it does on its own house', move: 'Show the practice itself, on your own work, with numbers.', pitch: 'practise on the house what the agency sells', tracks: [] };
      push({ kind: 'gap', code: g.code || 'gap', sev: 3, w: 3 * rarity(gapRate(g.code)), cls: 'observed', group: 'gap', finding: g.label, need: r.need, move: r.move, pitch: r.pitch, tracks: r.tracks, starter: r.starter, ask: r.ask, src: dossier, srcLabel: 'Dossier · Say and do' });
    }
    const hz = a.horus || {};
    if (hz.ok && hz.moves) {
      for (const p of Object.keys(MOVE)) {
        const s = hz.moves[p]; const r = MOVE[p], imp = implOf(p);
        if (s === 'absent' || s === 'partial') {
          const sev = s === 'absent' ? 2 : 1;
          push({ kind: 'move', code: p, sev, w: sev * rarity(moveRate(p, s)), cls: 'inferred', group: 'gap', finding: (imp ? imp.move : p) + ': ' + (s === 'absent' ? 'not seen in its record' : 'partial'), need: r.need, move: r.move, pitch: r.pitch, tracks: r.tracks, starter: r.starter, ask: r.ask, detail: imp ? imp.detail : null, src: dossier, srcLabel: 'Dossier · Horus moves' });
        } else if (s === 'making') {
          push({ kind: 'strength', code: p, sev: 0, w: 0.8 * rarity(moveRate(p, 'making')), cls: (hz.mev || []).includes(p) ? 'observed' : 'inferred', group: 'sell', finding: (imp ? imp.move : p) + ': already making this move', need: 'depth on a line it is already building', move: 'Speak to it in their terms; it is where they are investing.', pitch: 'add depth where it is already moving', tracks: r.tracks, src: dossier, srcLabel: 'Dossier · Horus moves' });
        }
      }
      const hti = hz.hti == null ? '' : (hz.hti > 0 ? '+' : '') + Math.round(hz.hti);
      const heads = hz.head || [], tails = hz.tail || [];
      if ((hz.band === 'Exposed' || hz.band === 'Headwind') && heads.length) {
        const tr = []; heads.forEach(k => (KJ_TRACK[k] || []).forEach(t => tr.push(t)));
        push({ kind: 'horus', code: hz.band, sev: hz.band === 'Headwind' ? 3 : 2, cls: 'computed', group: 'gap', finding: 'Horus reads it ' + hz.band + ' (' + hti + (hz.pct != null ? ', ' + ord(hz.pct) + ' percentile of the field' : '') + '); most exposed to ' + heads.map(k => k + ' (' + kjTitle(k) + ')').join(' and '), need: 'people who hedge the judgments it is exposed to: ' + heads.map(k => (KJ_TRACK[k] || []).map(t => TRACK[t].label).join(' and ')).join('; '), move: 'Frame your summary around the market shift the agency is exposed to and the practice that answers it.', pitch: 'bring the practice that answers the market shift it is exposed to', tracks: tr, ask: 'How is the agency preparing for ' + kjTitle(heads[0]).toLowerCase().replace(/\.$/, '') + '?', src: dossier, srcLabel: 'Dossier · Horus' });
      } else if ((hz.band === 'Favored' || hz.band === 'Tailwind') && tails.length) {
        const tr = []; tails.forEach(k => (KJ_TRACK[k] || []).forEach(t => tr.push(t)));
        push({ kind: 'strength', code: hz.band, sev: 0, w: 1, cls: 'computed', group: 'sell', finding: 'Horus reads it ' + hz.band + ' (' + hti + '): best placed for ' + tails.map(k => k + ' (' + kjTitle(k) + ')').join(' and '), need: 'practitioners on the lines the tailwind rewards: ' + tails.map(k => (KJ_TRACK[k] || []).map(t => TRACK[t].label).join(' and ')).join('; '), move: 'Speak to the lines it is investing in; it will hire where it is winning.', pitch: 'add depth where the market is already carrying it', tracks: tr, src: dossier, srcLabel: 'Dossier · Horus' });
      }
    }
    const mo = a.monsoon || {};
    if (mo.ok && (mo.band === 'Landfall' || mo.band === 'Onshore wind')) {
      const tops = (mo.top || []).slice(0, 2);
      const tr = ['N14']; tops.forEach(c => { if (DIM_TRACK[c.cap]) tr.push(DIM_TRACK[c.cap]); });
      push({ kind: 'monsoon', code: mo.band, sev: mo.band === 'Landfall' ? 2 : 1, cls: mo.cls || 'inferred', group: 'gap', finding: 'Monsoon reads it ' + mo.band + ' (' + Math.round(mo.index) + (mo.pct != null ? ', ' + ord(mo.pct) + ' percentile' : '') + '): ' + (tops.length ? tops.map(c => c.label).join(' and ') + ' carry the most movable hours' : 'offshore delivery is present or the mix cannot avoid it') + (mo.onshore ? '; it claims in-house delivery in its own words' : ''), need: 'onshore delivery leadership and a review layer over offshore or AI production, or the hours that cannot leave the market: strategy, client relationships, local market knowledge', move: (mo.onshore ? 'Back the in-house claim with hands-on craft, and ' : '') + 'show QA, vendor management and the client-facing work that stays onshore.', pitch: mo.onshore ? 'back an in-house delivery claim with hands-on craft' : 'lead onshore delivery and the review layer offshore production needs', tracks: tr, starter: TRACK.N14.starters[1], ask: 'What is the delivery model for ' + (tops.length ? tops.map(c => c.label.toLowerCase()).join(' and ') : 'the hours-heavy lines') + ': in house, partners, offshore?', src: dossier, srcLabel: 'Dossier · Offshore' });
    }
    const c = a.content || {};
    const gapCodes = new Set((a.gaps || []).map(g => g.code));
    if (c.urls && c.d90 === 0) { const rate = f.field && f.n ? (f.field.stalled || 0) / f.n : null; push({ kind: 'content', code: 'd90', sev: 2, w: 2 * rarity(rate), cls: 'observed', group: 'gap', finding: 'Nothing in its sitemap updated in 90 days (' + (c.d365 || 0) + ' pages in 365, ' + c.urls + ' listed)', need: 'an editorial lead who publishes on a cadence and ties it to search and AI citations', move: 'Show cadence: pieces per month, calendar, repurposing, and what the content produced.', pitch: 'restart an editorial cadence', tracks: ['N12', 'N1'], starter: TRACK.N12.starters[0], ask: 'What is the content cadence plan for the agency’s own site?', src: dossier, srcLabel: 'Dossier · Content & AI' }); }
    if (c.llms === false && strat.ai_search >= 1 && !gapCodes.has('ai_no_llms')) push({ kind: 'content', code: 'llms', sev: 1, cls: 'observed', group: 'gap', finding: 'Publishes no llms.txt while selling AI search (' + (c.ai_urls || 0) + ' AI topic pages)', need: 'an AI search practitioner who ships the machine-readable layer first', move: 'Name llms.txt, schema and entity work you shipped.', pitch: 'ship the machine-readable layer AI search reads', tracks: ['N9'], starter: TRACK.N9.starters[0], ask: GAP.ai_no_llms.ask, src: dossier, srcLabel: 'Dossier · Content & AI' });
    const pd = a.paid || {};
    if (pd.g === 'none' && strat.paid_search >= 2 && !gapCodes.has('search_no_ads')) push({ kind: 'paid', code: 'google', sev: 1, cls: 'observed', group: 'gap', finding: 'Sells paid search at level ' + strat.paid_search + ' with no Google ads of its own seen', need: GAP.search_no_ads.need, move: GAP.search_no_ads.move, pitch: GAP.search_no_ads.pitch, tracks: GAP.search_no_ads.tracks, starter: GAP.search_no_ads.starter, ask: GAP.search_no_ads.ask, src: dossier, srcLabel: 'Dossier · Paid & Social' });
    if (pd.g === 'active' && pd.g30) push({ kind: 'strength', code: 'ads', sev: 0, w: 1.5, cls: 'observed', group: 'sell', finding: 'Runs its own Google ads: ' + pd.g30 + ' creatives seen in the last 30 days' + (pd.gn ? ' of ' + pd.gn + ' on record' : ''), need: 'paid operators who can match the house standard', move: 'Mirror the ad language it runs; it tells you the metrics it sells.', pitch: 'match the paid standard it already runs', tracks: ['N2', 'N16'], src: dossier, srcLabel: 'Dossier · Paid & Social' });
    const lead = (a.lead || []).filter(d => DIM_TRACK[d]), core = (a.core || []).filter(d => DIM_TRACK[d] && !lead.includes(d));
    if (lead.length || core.length) push({ kind: 'sells', code: 'lines', sev: 0, w: 0, cls: 'observed', group: 'sell', finding: 'Sells ' + (lead.length ? lead.map(d => DIM_LABEL[d]).join(', ') + ' as its lead line' + (lead.length > 1 ? 's' : '') : '') + (lead.length && core.length ? '; ' : '') + (core.length ? core.map(d => DIM_LABEL[d]).join(', ') + ' at depth' : ''), need: 'practitioners on the lines it sells most', move: 'Lead your skills block with these lines, in this order.', pitch: 'deliver on its lead lines', tracks: lead.concat(core).map(d => DIM_TRACK[d]), src: dossier, srcLabel: 'Dossier · Strategy' });
    const nd = a.needs || {};
    const mixBy = {}; (nd.mix || []).forEach(m => { mixBy[m.code] = m; });
    const tops = (nd.top || []).filter(k => k !== 'N0');
    if (tops.length) {
      const tr = []; tops.forEach(k => (NEED_TRACK[k] || []).forEach(t => tr.push(t)));
      push({ kind: 'need', code: 'mix', sev: 1, w: 1, cls: 'observed', group: 'sell', finding: 'Its clients buy ' + tops.map(k => needLabel(k).toLowerCase() + (mixBy[k] && mixBy[k].share != null ? ' (' + pct(mixBy[k].share) + '%)' : '')).join(', ') + ' across ' + (a.clients ? a.clients.observed : 0) + ' observed engagements', need: 'practitioners on the lines its clients actually buy: ' + tops.map(k => needLabel(k).toLowerCase()).join(', '), move: 'Match your top skills block to these lines, in this order.', pitch: 'deliver the lines its clients buy most', tracks: tr, src: dossier, srcLabel: 'Dossier · Clients' });
    } else if ((nd.inferred || []).length) {
      const tr = nd.inferred.map(d => DIM_TRACK[d]).filter(Boolean);
      push({ kind: 'need', code: 'inferred', sev: 1, w: 0.6, cls: 'inferred', group: 'sell', finding: 'No client need observed; inferred from its sold mix: ' + nd.inferred.map(d => DIM_LABEL[d] || d).join(', '), need: 'practitioners on its lead lines: ' + nd.inferred.map(d => (DIM_LABEL[d] || d).toLowerCase()).join(', '), move: 'Match your skills block to its lead lines.', pitch: 'deliver on its lead lines', tracks: tr, src: dossier, srcLabel: 'Dossier · Clients' });
    }
    if (a.clients && a.clients.n > 0 && a.clients.observed === 0) push({ kind: 'proof', code: 'named', sev: 1, cls: 'observed', group: 'gap', finding: 'All ' + a.clients.n + ' clients on record are names only: no described results', need: 'case-study-grade proof: people who can write audited results', move: 'Bring quantified case studies; a thin-proof agency hires people who can produce results it can publish.', pitch: 'produce case-study-grade proof', tracks: ['N12', 'N13'], starter: TRACK.N12.starters[2], ask: 'Which client results can the agency show, and how are they audited?', src: dossier, srcLabel: 'Dossier · Clients' });
    const fs = (f.field && f.field.strategy) || [];
    const holes = fs.filter(s => s.invest_pct >= 45 && (strat[s.key] || 0) === 0).slice(0, 3);
    for (const s of holes) push({ kind: 'hole', code: s.key, sev: 1, w: 0.7, cls: 'computed', group: 'gap', finding: 'Does not sell ' + s.label + ' while ' + s.invest_pct + '% of the field does', need: 'someone who can open a ' + s.label.toLowerCase() + ' line', move: 'If you can run ' + s.label + ', say so in the summary: it is a line it could add.', pitch: 'open a ' + s.label.toLowerCase() + ' line', tracks: DIM_TRACK[s.key] ? [DIM_TRACK[s.key]] : [], ask: 'Is ' + s.label + ' on the roadmap, or deliberately not sold?', src: dossier, srcLabel: 'Dossier · Strategy' });
    if (a.hb) {
      const themes = (a.hb.themes || ['retention']).map(k => HB_THEME[k]).filter(Boolean);
      const tr = []; themes.forEach(t => t.tracks.forEach(x => tr.push(x))); if (!tr.includes('N13')) tr.push('N13');
      const first = themes[0] || HB_THEME.retention;
      push({ kind: 'hitboard', code: 'wave' + a.hb.wave, sev: 3, w: 3, cls: 'observed', group: 'gap', finding: 'On the Hit Board, wave ' + a.hb.wave + ': ' + (a.hb.arch || 'one of the ten agencies Leviathan rates as beatable') + ' The hiring theme' + (themes.length > 1 ? 's' : '') + ': ' + themes.map(t => t.label).join(', ') + '.', need: themes.map(t => t.need).join('; '), move: first.move, pitch: first.pitch, tracks: tr, starter: first.starter, ask: first.ask, src: '#hitboard.ten', srcLabel: 'Hit Board' });
    }
    if (a.status === 'merged' || a.status === 'acquired-rebranded') push({ kind: 'status', code: a.status, sev: 1, cls: 'observed', group: 'gap', finding: 'Status ' + a.status + (a.successor ? ' into ' + a.successor : '') + (a.status_note ? ': ' + a.status_note : ''), need: 'people who can run integration: migrated accounts, unified reporting, retained clients', move: 'Show integrations or migrations you led and the clients retained through them.', pitch: 'carry clients and accounts through an integration', tracks: ['N14', 'N13'], ask: 'How far along is the integration, and what changes for clients?', src: dossier, srcLabel: 'Dossier' });
    if (a.ownership === 'pe-backed') push({ kind: 'status', code: 'pe', sev: 1, cls: 'observed', group: 'gap', finding: 'Private-equity backed: margin and scale are the brief', need: 'operators who raise margin and utilization without losing clients', move: 'Lead with margin, utilization and retention numbers.', pitch: 'raise margin at scale', tracks: ['N14', 'N13'], ask: 'What does the ownership expect from the next two years: margin, growth, exit?', src: dossier, srcLabel: 'Dossier' });
    if (a.prom != null && a.prom < 0.3) push({ kind: 'prominence', code: 'low', sev: 1, cls: 'computed', group: 'gap', finding: 'Low prominence (' + pct(a.prom) + '/100): little self-promotion in the record', need: 'a marketer who markets the agency: content, PR, social, ads for the house', move: 'Show agency-side marketing you have done: the house blog, LinkedIn, awards, case studies.', pitch: 'market the agency itself', tracks: ['N12', 'N8'], ask: 'Who markets the agency itself?', src: dossier, srcLabel: 'Dossier' });
    const verts = E.verticals(a);
    if (verts.length) push({ kind: 'vertical', code: 'wings', sev: 1, w: 0, cls: 'observed', group: 'sell', finding: 'Sells into ' + verts.map(v => v.label.toLowerCase()).join(', ') + ': the wings Leviathan maps', need: 'practitioners with ' + verts.slice(0, 3).map(v => v.label.toLowerCase()).join(', ') + ' client experience', move: 'Tick the verticals you have worked in below; they go into the headline and the summary.', pitch: 'bring the vertical experience it sells into', tracks: [], src: '#agencies', srcLabel: 'Agency Field' });
    items.sort((x, y) => y.sev - x.sev || y.w - x.w);
    const tracks = rankTracks(items, a);
    const strong = items.filter(it => it.sev >= 2).length;
    const thin = !hz.ok || items.length < 3 || strong === 0 || (!a.deep && !tops.length && !(a.gaps || []).length);
    const thinWhy = !hz.ok ? 'no Horus read (' + (hz.reason || 'no capability scores') + ')' : items.length < 3 ? 'fewer than three findings' : strong === 0 ? 'no gap or exposure in the record' : 'a surface read: no deep dossier, no observed client needs, no say/do gaps';
    const vocab = E.vocab(a, tracks.length ? tracks[0].code : null);
    return { agency: a, items, tracks, vocab, verticals: verts, thin, thinWhy: thin ? thinWhy : null, brief: { bluf: (a.text || {}).bluf || null, openings: (a.text || {}).openings || null, written: (a.text || {}).written || null, horus: hz.ok ? hz.verdict : null, monsoon: mo.ok ? mo.verdict : null } };
  };
  /* two axes: demand (what it sells, what its clients buy, where it is moving) and angle (the gaps and exposures a hire would close) */
  function rankTracks(items, a) {
    const demand = Object.create(null), angle = Object.create(null), why = Object.create(null);
    const add = (box, t, w, reason) => { if (!TRACK[t] || !(w > 0)) return; box[t] = (box[t] || 0) + w; if (reason) (why[t] = why[t] || []).push(reason); };
    for (const it of items) {
      const box = it.group === 'sell' ? demand : angle;
      const w = it.group === 'sell' ? (it.w || 0.5) : it.w;
      it.tracks.forEach((t, i) => add(box, t, w * (i === 0 ? 1 : 0.6), i === 0 ? it.finding : null));
    }
    if (a && a.strat) {
      const lead = new Set(a.lead || []), core = new Set(a.core || []);
      for (const d in a.strat) { const t = DIM_TRACK[d]; if (!t) continue; const lv = a.strat[d]; const w = lead.has(d) ? 3 : core.has(d) ? 2 : lv >= 2 ? 1 : 0; add(demand, t, w, w >= 2 ? 'Sells ' + (DIM_LABEL[d] || d) + (lead.has(d) ? ' as a lead line' : ' at depth') : null); }
      const mix = (a.needs && a.needs.mix) || [];
      mix.forEach(m => { if (m.code === 'N0' || !(m.share > 0)) return; (NEED_TRACK[m.code] || []).forEach((t, i) => add(demand, t, m.share * 4 * (i === 0 ? 1 : 0.5), null)); });
      (a.needs && a.needs.top || []).forEach((k, i) => (NEED_TRACK[k] || []).forEach((t, j) => add(demand, t, (3 - i) * (j === 0 ? 1 : 0.5), null)));
    }
    const order = (a && a.needs && a.needs.top) || [];
    const r = n => Math.round((n || 0) * 10) / 10;
    return TRACKS.map(t => ({ code: t.code, label: t.label, titles: t.titles, demand: r(demand[t.code]), angle: r(angle[t.code]), score: r((demand[t.code] || 0) + (angle[t.code] || 0)), why: Array.from(new Set(why[t.code] || [])).slice(0, 4) }))
      .sort((x, y) => y.score - x.score || y.demand - x.demand || (order.indexOf(x.code) + 1 || 99) - (order.indexOf(y.code) + 1 || 99) || TRACKS.findIndex(t => t.code === x.code) - TRACKS.findIndex(t => t.code === y.code));
  }
  /* the agency's own words, grouped by origin; products are named to be recognized, never claimed */
  E.vocab = function (a, trackCode) {
    const out = [], seen = new Set();
    const put = (t, src, note) => { const k = String(t || '').trim(); if (!k) return; const key = k.toLowerCase(); if (seen.has(key)) return; seen.add(key); out.push({ t: k, src, note: note || null }); };
    if (a) {
      (a.services || []).forEach(s => put(s, 'service', 'a service line on its site'));
      for (const d in (a.strat || {})) if (a.strat[d] >= 2) put(DIM_LABEL[d] || d, 'line', 'sold at level ' + a.strat[d] + ' of 3');
      (a.needs && a.needs.top || []).filter(k => k !== 'N0').forEach(k => put(needLabel(k), 'need', 'what its clients buy'));
      (a.verticals || []).slice(0, 10).forEach(v => put(v, 'vertical', 'a vertical it publishes'));
      (a.tags || []).forEach(t => put(CONSENT.has(t) ? 'consent management (' + TOOL[t] + ')' : (TOOL[t] || t), 'tool', 'seen on its own site'));
      (a.cms || []).forEach(c => put(c, 'tool', 'its own site runs on it'));
      (a.proprietary || []).forEach(p => put(p.replace(/\s*\(.*$/, ''), 'product', 'its own product: mention familiarity, do not claim'));
    }
    const p = E.profile(trackCode || 'N1');
    (p.keywords || []).forEach(k => put(k, 'track', 'from the ' + p.label + ' track'));
    return out.slice(0, 56);
  };
  /* the terms the mirror readout counts: what it sells and the track's words; tools seen on its site and its products are not candidate skills */
  E.mirrorTerms = function (vocab) { return (vocab || []).filter(v => v.src !== 'tool' && v.src !== 'product'); };
  E.starters = function (read, trackCode) {
    const out = [], seen = new Set();
    const put = (s, from) => { if (!s || seen.has(s)) return; seen.add(s); out.push({ t: s, from }); };
    (read && read.items || []).filter(it => it.starter && it.sev > 0 && (!trackCode || it.tracks.includes(trackCode))).forEach(it => put(it.starter, it.finding));
    (E.profile(trackCode || 'N1').starters || []).forEach(s => put(s, 'track'));
    return out.slice(0, 8);
  };

  /* ---------- Clapback's text tools, with whole-word matching and a phrase lexicon ---------- */
  const STOP = new Set("a an the and or but if then of to in on for with at by from as is are was were be been being this that these those you your we our it its their his her they them i me my us he she do does did have has had not no yes will would can could should may might must about into over under out up down off than too very more most such own same so can't cant per via etc within across their them our your you're we're job role work team company please apply applicant candidate position ideal strong excellent required requirements responsibilities preferred plus experience ability years year marketing digital clients client agency skills including include ensure working knowledge understanding who what when where how new one two three day days week weeks month months time well also able based other across between both each every some any all level high strong proven looking seeking hiring join".split(/\s+/));
  const PHRASES = ['paid social', 'paid search', 'paid media', 'local services ads', 'google ads', 'meta ads', 'microsoft ads', 'linkedin ads', 'tiktok ads', 'performance max', 'smart bidding', 'google business profile', 'business profile', 'search console', 'tag manager', 'google tag manager', 'conversions api', 'server-side tagging', 'marketing mix modeling', 'email marketing', 'lifecycle marketing', 'account-based marketing', 'demand generation', 'content strategy', 'content marketing', 'digital pr', 'technical seo', 'local seo', 'link building', 'ai overviews', 'ai search', 'llms.txt', 'structured data', 'schema markup', 'conversion rate optimization', 'landing pages', 'landing page', 'call tracking', 'lead generation', 'lead quality', 'retail media', 'programmatic', 'first-party data', 'media planning', 'media buying', 'creative testing', 'social media', 'short-form video', 'influencer marketing', 'creator partnerships', 'community management', 'account management', 'client retention', 'project management', 'quality assurance', 'looker studio', 'data studio', 'google analytics', 'a/b testing', 'core web vitals', 'map pack', 'cost per lead', 'cost per acquisition', 'return on ad spend', 'law firm', 'law firms', 'home services', 'personal injury', 'family law', 'criminal defense', 'med spa', 'multi-location', 'franchise marketing', 'reputation management', 'review management', 'case studies', 'thought leadership', 'earned media', 'brand strategy', 'web design', 'website design', 'ux design', 'customer data platform', 'marketing automation', 'ga4', 'gtm', 'roas', 'cpa', 'cpl', 'ctr', 'mmm', 'gbp', 'lsa', 'lsas', 'seo', 'sem', 'ppc', 'cro', 'crm', 'abm', 'ugc', 'geo', 'ctv', 'hubspot', 'salesforce', 'klaviyo', 'bigquery', 'sql', 'tableau', 'wordpress', 'webflow', 'shopify', 'callrail', 'semrush', 'ahrefs', 'screaming frog', 'optimizely', 'vwo', 'hotjar', 'chatgpt', 'gemini', 'perplexity', 'copilot'];
  E.STOP = STOP; E.PHRASES = PHRASES;
  const escapeRe = s => String(s).replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&');
  const norm = t => String(t || '').replace(/\s*\(.*\)\s*$/, '').trim();
  function reBody(t) { return escapeRe(norm(t).toLowerCase()).replace(/\s+/g, '[\\s-]+'); }
  function termRe(t) { return new RegExp('(?:^|[^a-z0-9])' + reBody(t) + '(?=$|[^a-z0-9])', 'i'); }
  function countRe(t) { return new RegExp('(?:^|[^a-z0-9])' + reBody(t) + '(?=$|[^a-z0-9])', 'gi'); }
  E.hasTerm = function (text, term) { if (!norm(term)) return false; return termRe(term).test(String(text || '')); };
  E.countTerm = function (text, term) { if (!norm(term)) return 0; return (String(text || '').match(countRe(term)) || []).length; };
  const WEAK = [
    { re: /\bresponsible for\b/gi, tip: '‘responsible for’ → lead with an action verb (Managed, Owned, Ran).' },
    { re: /\bduties included\b/gi, tip: '‘duties included’ → replace with what you actually achieved.' },
    { re: /\bhelped (?:to )?\b/gi, tip: '‘helped’ is vague → name your specific contribution.' },
    { re: /\bworked on\b/gi, tip: '‘worked on’ → say what you built, shipped, or delivered.' },
    { re: /\bassisted with\b/gi, tip: '‘assisted with’ → state your direct action and result.' },
    { re: /\bteam player\b/gi, tip: '‘team player’ is filler → show collaboration with a concrete example.' },
    { re: /\bresults[- ]driven\b/gi, tip: '‘results-driven’ is filler → show the result instead.' },
    { re: /\bhard[- ]working\b/gi, tip: '‘hard-working’ is filler → let an achievement demonstrate it.' },
  ];
  /* Leviathan's own vocabulary has no place in a résumé */
  const JARGON = [/\bHorus\b/i, /\bMonsoon\b/i, /\bLandfall\b/i, /\bOnshore wind\b/i, /\bDoldrums\b/i, /\bHit Board\b/i, /\bsay\s*\/\s*do\b/i, /\bOmegaWeapon\b/i, /\bLeviathan\b/i, /\bAgency Radar\b/i, /\bRadar dossier\b/i, /\bKJ\d{1,2}\b/, /\bP[1-8]\b(?= (?:absent|partial|making|move))/i, /\bSolar Arc\b/i, /\bThe Walled Oasis\b/i, /\bBazaar of Agents\b/i, /\bToll Road\b/i, /\bCommons Rebuilt\b/i, /\bwedge\b/i, /\bkill list\b/i];
  E.JARGON = JARGON;
  E.jargon = text => { const t = String(text || ''); const hits = []; for (const re of JARGON) { const m = t.match(re); if (m) hits.push(m[0]); } return hits; };
  function syllables(word) {
    word = word.toLowerCase().replace(/[^a-z]/g, '');
    if (word.length <= 3) return word.length ? 1 : 0;
    word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '');
    const m = word.match(/[aeiouy]{1,2}/g);
    return m ? m.length : 1;
  }
  /* bullets and headers are sentences of their own: a line break ends a sentence */
  E.readability = function (text) {
    const clean = (text || '').trim();
    if (!clean) return null;
    const sentences = clean.split(/[.!?]+(?:\s|$)|\n+/).filter(s => s.trim().length);
    const words = clean.match(/[A-Za-z0-9'’-]+/g) || [];
    if (!words.length) return null;
    const nS = Math.max(sentences.length, 1), nW = words.length;
    const nSyl = words.reduce((a, w) => a + syllables(w), 0);
    const grade = 0.39 * (nW / nS) + 11.8 * (nSyl / nW) - 15.59;
    const ease = 206.835 - 1.015 * (nW / nS) - 84.6 * (nSyl / nW);
    const longSentences = sentences.filter(s => (s.match(/\S+/g) || []).length > 25).length;
    const passive = (clean.match(/\b(?:was|were|been|being|is|are|be)\b\s+\w+(?:ed|en)\b/gi) || []).length;
    const weak = [];
    WEAK.forEach(w => { w.re.lastIndex = 0; if (w.re.test(clean)) weak.push(w.tip); w.re.lastIndex = 0; });
    return { grade: Math.max(0, Math.round(grade * 10) / 10), ease: Math.round(ease), words: nW, sentences: nS, avgSentence: Math.round((nW / nS) * 10) / 10, longSentences, passive, weak };
  };
  /* the posting's own words: phrases from the lexicon first, then single tokens, by frequency */
  E.keywordsFrom = function (text, topN) {
    const t = String(text || '').toLowerCase();
    const found = [];
    for (const p of PHRASES) { const n = (t.match(countRe(p)) || []).length; if (n) found.push([p, n + (p.includes(' ') ? 0.5 : 0)]); }
    const covered = new Set(); found.forEach(([p]) => p.split(/[\s-]+/).forEach(w => covered.add(w)));
    const words = (t.match(/[a-z][a-z+.#-]{2,}/g) || []);
    const freq = {};
    words.forEach(w => { w = w.replace(/[.,;:]+$/, ''); if (!STOP.has(w) && w.length > 2 && !covered.has(w)) freq[w] = (freq[w] || 0) + 1; });
    Object.entries(freq).forEach(([w, n]) => found.push([w, n]));
    return found.sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, topN || 20).map(x => x[0]);
  };

  /* ---------- the draft: the candidate's facts, and one tailoring per agency ---------- */
  E.blankCandidate = () => ({ name: '', contact: '', years: '', level: null, skills: '', results: '', education: '', exp: [{ title: '', org: '', dates: '', bullets: '' }], verticals: [] });
  E.blankTailor = () => ({ track: null, industry: null, role: '', summary: '', terms: [], posting: '' });
  E.blankDraft = () => ({ v: 2, candidate: E.blankCandidate(), tailor: {}, general: E.blankTailor(), last: { agency: null } });
  const lines = s => String(s || '').split('\n').map(x => x.trim()).filter(Boolean);
  const bulletsOf = x => lines(x.bullets).map(b => b.replace(/^[•\-*]\s*/, ''));
  const splitSkills = s => String(s || '').split(/,|\n|·/).map(x => x.trim()).filter(Boolean);
  E.splitSkills = splitSkills;
  /* the skills block: the terms tailored for this agency first, then the candidate's own, deduplicated */
  E.skillsFor = function (cand, tail) { const out = [], seen = new Set(); const put = s => { const k = s.toLowerCase(); if (!seen.has(k)) { seen.add(k); out.push(s); } }; (tail && tail.terms || []).forEach(put); splitSkills(cand && cand.skills).forEach(put); return out; };
  E.levelOf = (cand) => (cand && cand.level) || E.levelFromYears(cand && cand.years);
  E.trackOf = (tail) => (tail && (tail.track || tail.industry)) || 'marketing';
  E.roleOf = function (cand, tail) { return (tail && tail.role || '').trim() || E.titleFor(E.trackOf(tail), E.levelOf(cand)); };
  E.autoSummary = function (cand, tail, read) {
    cand = cand || E.blankCandidate(); tail = tail || E.blankTailor();
    const code = E.trackOf(tail);
    const p = E.profile(code);
    const role = E.roleOf(cand, tail);
    const years = (cand.years || '').trim() || 'several years of experience';
    const skills = E.skillsFor(cand, tail);
    const s1 = skills[0] || p.keywords[0], s2 = skills[1] || p.keywords[1];
    let s = p.summary.replace('%ROLE%', role).replace('%YEARS%', years).replace('%SKILL1%', s1).replace('%SKILL2%', s2);
    const level = E.levelOf(cand);
    if (level === 'manager') s += ' Leads a team of [N] across [N] accounts.';
    else if (level === 'director') s += ' Owns the practice: a team of [N], $[X] a year in client revenue, [X]% retention.';
    const a = read && read.agency;
    if (a) {
      const top = (read.items || []).filter(it => it.pitch && it.sev > 0 && (!tail.track || it.tracks.includes(tail.track)))[0] || (read.items || []).filter(it => it.pitch && it.sev > 0)[0];
      const ticked = (cand.verticals || []).filter(k => VERT[k]);
      const agencyVerts = (read.verticals || []).map(v => v.key);
      const first = ticked.filter(k => agencyVerts.includes(k)).concat(ticked.filter(k => !agencyVerts.includes(k))).map(k => VERT[k].label.toLowerCase());
      const who = first.length ? 'an agency selling into ' + first.slice(0, 3).join(', ') : 'the agency';
      s += ' Ready to ' + (top ? top.pitch : 'deliver on the lines its clients buy') + ' for ' + who + '.';
    }
    return s;
  };
  E.headline = function (cand, tail) {
    cand = cand || E.blankCandidate(); tail = tail || E.blankTailor();
    const role = E.roleOf(cand, tail);
    const skills = E.skillsFor(cand, tail).slice(0, 3);
    const verts = (cand.verticals || []).map(k => VERT[k] ? VERT[k].label : null).filter(Boolean).slice(0, 3);
    return [role, skills.join(' · '), verts.join(', ')].filter(Boolean).join(' | ');
  };
  /* the plain text build: one column, ASCII separators, standard headers, nothing a parser can scramble; no hard wrapping */
  E.build = function (cand, tail, read) {
    cand = cand || E.blankCandidate(); tail = tail || E.blankTailor();
    const name = (cand.name || '').trim() || 'Your Name';
    const contact = (cand.contact || '').trim();
    const summary = (tail.summary || '').trim() || E.autoSummary(cand, tail, read);
    const skills = E.skillsFor(cand, tail);
    const L = [name.toUpperCase(), E.headline(cand, tail)];
    if (contact) L.push(contact);
    L.push('');
    if (summary) L.push('SUMMARY', summary, '');
    if (skills.length) L.push('SKILLS', skills.join(', '), '');
    const exp = (cand.exp || []).filter(x => x.title || x.org || x.bullets);
    if (exp.length) {
      L.push('EXPERIENCE');
      exp.forEach(x => {
        L.push([x.title, x.org].filter(Boolean).join(', ') + (x.dates ? ' (' + x.dates + ')' : ''));
        bulletsOf(x).forEach(b => L.push('- ' + b));
        L.push('');
      });
    }
    const results = lines(cand.results);
    if (results.length) { L.push('SELECTED RESULTS'); results.forEach(r => L.push('- ' + r.replace(/^[•\-*]\s*/, ''))); L.push(''); }
    const edu = lines(cand.education);
    if (edu.length) { L.push('EDUCATION & CERTIFICATIONS'); edu.forEach(s => L.push(s)); L.push(''); }
    return L.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
  };
  E.markdown = function (cand, tail, read) {
    cand = cand || E.blankCandidate(); tail = tail || E.blankTailor();
    const name = (cand.name || '').trim() || 'Your Name';
    const summary = (tail.summary || '').trim() || E.autoSummary(cand, tail, read);
    const skills = E.skillsFor(cand, tail);
    const L = ['# ' + name, '', '**' + E.headline(cand, tail) + '**', ''];
    if ((cand.contact || '').trim()) L.push(cand.contact.trim(), '');
    if (summary) L.push('## Summary', '', summary, '');
    if (skills.length) L.push('## Skills', '', skills.join(', '), '');
    const exp = (cand.exp || []).filter(x => x.title || x.org || x.bullets);
    if (exp.length) { L.push('## Experience', ''); exp.forEach(x => { L.push('**' + [x.title, x.org].filter(Boolean).join(', ') + '**' + (x.dates ? ' · ' + x.dates : ''), ''); bulletsOf(x).forEach(b => L.push('- ' + b)); L.push(''); }); }
    const results = lines(cand.results);
    if (results.length) { L.push('## Selected results', ''); results.forEach(r => L.push('- ' + r.replace(/^[•\-*]\s*/, ''))); L.push(''); }
    const edu = lines(cand.education);
    if (edu.length) { L.push('## Education & certifications', ''); edu.forEach(s => L.push(s)); L.push(''); }
    return L.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
  };
  /* the same résumé as a small HTML document, for printing to PDF: one column, real headings, a list per role */
  E.html = function (cand, tail, read) {
    cand = cand || E.blankCandidate(); tail = tail || E.blankTailor();
    const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const name = (cand.name || '').trim() || 'Your Name';
    const summary = (tail.summary || '').trim() || E.autoSummary(cand, tail, read);
    const skills = E.skillsFor(cand, tail);
    const H = ['<h1>' + esc(name) + '</h1>', '<p class="hl">' + esc(E.headline(cand, tail)) + '</p>'];
    if ((cand.contact || '').trim()) H.push('<p class="ct">' + esc(cand.contact.trim()) + '</p>');
    if (summary) H.push('<h2>Summary</h2><p>' + esc(summary) + '</p>');
    if (skills.length) H.push('<h2>Skills</h2><p>' + esc(skills.join(', ')) + '</p>');
    const exp = (cand.exp || []).filter(x => x.title || x.org || x.bullets);
    if (exp.length) { H.push('<h2>Experience</h2>'); exp.forEach(x => { H.push('<p class="role"><b>' + esc([x.title, x.org].filter(Boolean).join(', ')) + '</b>' + (x.dates ? ' <span>' + esc(x.dates) + '</span>' : '') + '</p>'); const bs = bulletsOf(x); if (bs.length) H.push('<ul>' + bs.map(b => '<li>' + esc(b) + '</li>').join('') + '</ul>'); }); }
    const results = lines(cand.results);
    if (results.length) H.push('<h2>Selected results</h2><ul>' + results.map(r => '<li>' + esc(r.replace(/^[•\-*]\s*/, '')) + '</li>').join('') + '</ul>');
    const edu = lines(cand.education);
    if (edu.length) H.push('<h2>Education &amp; certifications</h2>' + edu.map(s => '<p>' + esc(s) + '</p>').join(''));
    return H.join('\n');
  };
  E.fileStem = function (cand, tail, read) {
    const clean = s => String(s || '').trim().replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-');
    const n = clean(cand && cand.name) || 'resume';
    const r = clean(E.roleOf(cand || {}, tail || {}));
    const a = read && read.agency ? read.agency.id : '';
    return [n, r, a].filter(Boolean).join('-');
  };

  /* ---------- the ATS readiness: structure only, with hard gates; what the agency's words add is a separate readout ---------- */
  const VERBS = (() => { const s = new Set(); TRACKS.forEach(t => t.verbs.forEach(v => s.add(v.toLowerCase()))); INDUSTRIES.forEach(i => i.verbs.forEach(v => s.add(v.toLowerCase()))); ['achieved', 'created', 'developed', 'drove', 'established', 'generated', 'implemented', 'improved', 'increased', 'led', 'owned', 'ran', 'saved', 'won', 'wrote', 'raised', 'secured', 'trained', 'turned', 'doubled', 'tripled', 'halved', 'coached', 'hired', 'opened', 'closed', 'moved', 'rebuilt', 'restored', 'planned', 'negotiated', 'presented', 'reported'].forEach(v => s.add(v)); return s; })();
  E.VERBS = VERBS;
  const yearsIn = s => (String(s || '').match(/\b(19|20)\d{2}\b/g) || []).map(Number);
  function endYear(dates) { if (/present|current|now|today/i.test(dates || '')) return 9999; const y = yearsIn(dates); return y.length ? Math.max.apply(null, y) : null; }
  const LENGTH = { junior: [250, 500], mid: [300, 700], senior: [380, 850], manager: [400, 900], director: [450, 1000] };
  E.LENGTH = LENGTH;
  E.lint = function (text, cand, tail, opts) {
    opts = opts || {}; cand = cand || E.blankCandidate(); tail = tail || E.blankTailor();
    const t = String(text || '');
    const level = E.levelOf(cand);
    const exp = (cand.exp || []).filter(x => x.title || x.org || x.bullets);
    const bullets = []; exp.forEach(x => bulletsOf(x).forEach(b => bullets.push(b))); lines(cand.results).forEach(b => bullets.push(b.replace(/^[•\-*]\s*/, '')));
    const contact = String(cand.contact || '');
    const hasEmail = /[\w.+-]+@[\w-]+\.[\w.-]+/.test(contact), hasPhone = /(\+?\d[\d\s().-]{7,}\d)/.test(contact), hasPlace = /\b[A-Z][a-z]+(?: [A-Z][a-z]+)*,\s*[A-Z]{2}\b/.test(contact) || /\b(?:remote|london|paris|berlin|madrid|amsterdam|dublin|toronto)\b/i.test(contact), hasUrl = /linkedin\.com|https?:\/\/|www\.|\.com\/|\.io\b|\.me\b/i.test(contact);
    const verbShare = bullets.length ? bullets.filter(b => { const w = (b.match(/^[A-Za-z-]+/) || [''])[0].toLowerCase(); return VERBS.has(w) || /^[a-z-]+ed$/.test(w); }).length / bullets.length : 0;
    const numShare = bullets.length ? bullets.filter(b => /\d|%|\$/.test(b)).length / bullets.length : 0;
    const ends = exp.map(x => endYear(x.dates));
    const undated = exp.filter((x, i) => ends[i] == null).length;
    let ordered = true; for (let i = 1; i < ends.length; i++) if (ends[i] != null && ends[i - 1] != null && ends[i] > ends[i - 1]) ordered = false;
    /* readability on the prose and the bullets: not the name, the headline, the contact line or the skills block */
    const all = t.split('\n');
    const prose = all.filter((l, i) => i > 2 && !/^(SKILLS|SUMMARY|EXPERIENCE|SELECTED RESULTS|EDUCATION & CERTIFICATIONS)$/.test(l) && all[i - 1] !== 'SKILLS').join('\n');
    const r = E.readability(prose);
    const words = (t.match(/[A-Za-z0-9'’-]+/g) || []).length;
    const placeholders = (t.match(/\[[^\]\n]{1,60}\]/g) || []).length;
    const jargon = E.jargon(t);
    const role = E.roleOf(cand, tail), code = E.trackOf(tail);
    const headline = all[1] || '';
    const titleOk = E.isAlias(role, code) ? 1 : role && E.hasTerm(headline, role) ? 0.6 : 0;
    const weakHits = r ? r.weak.length : 0;
    const band = LENGTH[level] || LENGTH.mid;
    const checks = [
      { id: 'title', w: 20, label: 'Headline carries a title the track is posted under', v: titleOk, tip: titleOk >= 1 ? 'The headline names the role.' : 'Use a title agencies post for this track (pick one from the track card) so a title search finds you; keep your own wording in the summary.' },
      { id: 'numbers', w: 20, label: 'Bullets carry numbers', v: bullets.length ? Math.min(1, numShare / 0.6) : 0, tip: 'Put a number in most bullets: %, $, counts, months. Numbers survive the parser and the six-second skim.', detail: bullets.length ? Math.round(numShare * 100) + '% of ' + bullets.length : 'no bullets' },
      { id: 'dates', w: 15, label: 'Dated roles, most recent first', v: exp.length ? (undated ? 0 : 0.6) + (ordered ? 0.4 : 0) : 0, tip: 'Give every role a month and year range (Jan 2022 – Present) and list the most recent first.', detail: undated ? undated + ' undated' : ordered ? 'in order' : 'out of order' },
      { id: 'verbs', w: 15, label: 'Bullets lead with action verbs', v: bullets.length ? Math.max(0, Math.min(1, verbShare / 0.8) - weakHits * 0.15) : 0, tip: 'Start each bullet with a verb (Grew, Cut, Shipped, Ranked), then what you did, then the result.' + (weakHits ? ' Filler phrases found: ' + (r ? r.weak.join(' ') : '') : ''), detail: bullets.length ? Math.round(verbShare * 100) + '% verb-led' : 'no bullets' },
      { id: 'contact', w: 10, label: 'Contact line: email, phone, city, one link', v: (hasEmail ? 0.4 : 0) + (hasPhone ? 0.3 : 0) + (hasPlace ? 0.2 : 0) + (hasUrl ? 0.1 : 0), tip: 'Put city and state, email, phone and one profile link as plain text under your name; some parsers skip headers and footers.' },
      { id: 'headers', w: 10, label: 'Standard section headers', v: ['SUMMARY', 'SKILLS', 'EXPERIENCE', 'EDUCATION'].filter(h => t.includes('\n' + h)).length / 4, tip: 'Use the headers parsers expect: Summary, Skills, Experience, Education. Fill the sections you have.' },
      { id: 'length', w: 5, label: 'Length for a ' + level + ' résumé: ' + band[0] + ' to ' + band[1] + ' words', v: words >= band[0] && words <= band[1] ? 1 : words >= band[0] * 0.7 && words <= band[1] * 1.25 ? 0.5 : 0, tip: 'One page for under ten years, two at most. Cut duties, keep results.', detail: words + ' words' },
      { id: 'grade', w: 5, label: 'Reads at grade 11.5 or below', v: r ? (r.grade <= 11.5 ? 1 : r.grade <= 13.5 ? 0.5 : 0) : 0, tip: 'Shorter sentences and plainer words. Résumés read best around grade 8 to 11.', detail: r ? 'grade ' + r.grade : 'no text' },
    ];
    const gates = [];
    if (placeholders) gates.push({ id: 'placeholders', label: placeholders + ' [placeholder' + (placeholders > 1 ? 's' : '') + '] left', tip: 'Fill each bracket with your own number or delete the line. A starter is a template, not a claim.' });
    if (!hasEmail && !hasPhone) gates.push({ id: 'reach', label: 'No email or phone', tip: 'A recruiter cannot reach you. Add an email address and a phone number to the contact line.' });
    if (undated) gates.push({ id: 'undated', label: undated + ' role' + (undated > 1 ? 's' : '') + ' without dates', tip: 'Every role needs a year range; undated roles fail the parse and the read.' });
    if (jargon.length) gates.push({ id: 'jargon', label: 'Leviathan’s own words in the résumé: ' + jargon.join(', '), tip: 'A résumé is not a pitch. Say what you did in plain terms; keep Leviathan’s reads for the interview brief.' });
    let score = Math.round(checks.reduce((a, c) => a + c.w * c.v, 0));
    const ready = gates.length === 0;
    if (!ready) score = Math.min(score, 40);
    /* claims: a skill nowhere in the experience (titles and bullets), the results or the education is a word without evidence; the summary is not evidence */
    const evidence = [cand.results, cand.education].concat(exp.map(x => [x.title, x.org, x.bullets].join('\n'))).join('\n');
    const skills = E.skillsFor(cand, tail);
    const claims = skills.filter(s => !E.hasTerm(evidence, s) && !E.hasTerm(evidence, s.split(/\s*\(/)[0]) && !s.split(/[\s/&]+/).some(w => w.length > 3 && E.hasTerm(evidence, w)));
    return { score, ready, gates, checks: checks.map(c => Object.assign({}, c, { ok: c.v >= 0.999, part: c.v > 0 && c.v < 0.999 })), words, grade: r ? r.grade : null, bullets: bullets.length, level, claims, readability: r };
  };
  /* the words it uses, counted: whole words, once each, worth more inside a quantified bullet, capped, with stuffing noted */
  E.mirror = function (text, cand, terms, opts) {
    opts = opts || {}; cand = cand || E.blankCandidate();
    const t = String(text || '');
    const list = (terms || []).map(v => (typeof v === 'string' ? v : v.t)).filter(v => norm(v));
    const bullets = []; (cand.exp || []).forEach(x => bulletsOf(x).forEach(b => bullets.push(b))); lines(cand.results).forEach(b => bullets.push(b));
    const quantified = bullets.filter(b => /\d|%|\$/.test(b)).join('\n');
    const present = [], missing = [], overused = [];
    /* the headline is the engine's own line; over-use is judged on the rest */
    const body = t.split('\n').filter((l, i) => i !== 1).join('\n');
    const counts = Object.create(null); list.forEach(term => { counts[term] = E.countTerm(body, term); });
    for (const term of list) {
      const n = E.countTerm(t, term);
      if (!n) { missing.push(term); continue; }
      const inBullet = E.hasTerm(quantified, term);
      present.push({ t: term, n, where: inBullet ? 'in a quantified bullet' : 'in the skills block or summary', pts: inBullet ? 2 : 1 });
      /* a word inside a longer listed phrase ("SEO" in "Law firm SEO") is that phrase's use, and the role's own name recurs by design */
      if (opts.role && E.hasTerm(opts.role, term)) continue;
      const own = (counts[term] || 0) - list.filter(o => o !== term && norm(o).length > norm(term).length && E.hasTerm(o, term)).reduce((a, o) => a + (counts[o] || 0), 0);
      if (own > (norm(term).includes(' ') ? 4 : 6)) overused.push(term + ' ×' + n);
    }
    present.sort((a, b) => b.pts - a.pts || b.n - a.n);
    const cap = opts.cap || 10;
    const pts = Math.min(cap, present.reduce((a, p) => a + p.pts, 0));
    return { present, missing, overused, pts, cap, total: list.length, source: opts.source || 'agency' };
  };
  E.match = function (jd, resumeText, vocab) {
    const resume = String(resumeText || '');
    const kws = E.keywordsFrom(jd, 24);
    const have = kws.filter(k => E.hasTerm(resume, k));
    const miss = kws.filter(k => !E.hasTerm(resume, k));
    const jdText = String(jd || '');
    const terms = (vocab || []).map(v => (typeof v === 'string' ? v : v.t));
    const inPosting = terms.filter(v => E.hasTerm(jdText, v));
    return { keywords: kws, have, miss, read: E.readability(jdText), agencyTermsInPosting: inPosting };
  };

  /* ---------- the brief: what Leviathan knows, for the interview; nothing a rival wrote ---------- */
  E.brief = function (read, cand, tail, opts) {
    opts = opts || {}; cand = cand || E.blankCandidate(); tail = tail || E.blankTailor();
    const a = read && read.agency; if (!a) return '';
    const meta = E.meta() || {};
    const L = ['# Interview brief: ' + a.name, '', '*' + [a.domain, a.hq, a.segment, a.ownership && a.ownership !== 'unknown' ? a.ownership : null, a.status !== 'active' ? a.status : null].filter(Boolean).join(' · ') + '*', ''];
    L.push('From Leviathan’s Résumé Forge. The Core’s Agency Radar read ' + a.domain + '’s public record (compiled ' + (meta.generated || '?') + ', Horus edition ' + (meta.edition || '?') + '). These are model-based reads of what the agency sells and shows, not a job posting: it may not be hiring for this. Check the site and the posting before you say any of it out loud.', '');
    if (read.brief && read.brief.bluf) L.push('## In one paragraph', '', read.brief.bluf, '');
    if (read.thin) L.push('> Thin record: ' + read.thinWhy + '. Tailor from the posting more than from these findings.', '');
    L.push('## The read', '');
    if (a.horus && a.horus.ok) L.push('- Market tailwind (Horus): ' + a.horus.band + ' ' + (a.horus.hti > 0 ? '+' : '') + Math.round(a.horus.hti) + (a.horus.pct != null ? ', ' + ord(a.horus.pct) + ' percentile' : '') + (a.horus.tail && a.horus.tail.length ? '. Best placed for ' + a.horus.tail.map(k => kjTitle(k).toLowerCase()).join('; ') : '') + (a.horus.head && a.horus.head.length ? '. Most exposed to ' + a.horus.head.map(k => kjTitle(k).toLowerCase()).join('; ') : ''));
    if (a.monsoon && a.monsoon.ok) L.push('- Offshore exposure (Monsoon): ' + a.monsoon.band + ' ' + Math.round(a.monsoon.index) + (a.monsoon.top && a.monsoon.top.length ? '; the movable hours sit in ' + a.monsoon.top.slice(0, 2).map(c => c.label).join(' and ') : '') + (a.monsoon.onshore ? '; claims in-house delivery' : ''));
    if (a.prom != null) L.push('- Prominence ' + pct(a.prom) + '/100' + (a.clients ? ' · ' + a.clients.n + ' clients on record, ' + a.clients.observed + ' with an observed need' : ''));
    if (a.paid) L.push('- Paid: Google ads ' + (a.paid.g || 'not checked') + (a.paid.g30 ? ' (' + a.paid.g30 + ' in the last 30 days)' : '') + ' · LinkedIn ads ' + (a.paid.li || 'not checked'));
    if (a.content) L.push('- Content: ' + (a.content.urls || 0) + ' sitemap URLs, ' + (a.content.d90 || 0) + ' updated in 90 days, llms.txt ' + (a.content.llms === true ? 'yes' : a.content.llms === false ? 'no' : 'not checked'));
    L.push('');
    L.push('## Role tracks', '');
    read.tracks.filter(t => t.score > 0).slice(0, 3).forEach((t, i) => L.push((i + 1) + '. **' + t.label + '** (' + Object.values(t.titles).slice(0, 3).join(' / ') + ') · demand ' + t.demand + ', angle ' + t.angle + (t.why.length ? '\n   ' + t.why.slice(0, 3).join('; ') : '')));
    L.push('');
    const gaps = read.items.filter(it => it.group === 'gap'), sells = read.items.filter(it => it.group === 'sell');
    if (gaps.length) { L.push('## Gaps it shows (' + gaps.length + ')', ''); gaps.forEach(it => L.push('- **' + SEV_LABEL[it.sev] + '**, ' + it.cls + ': ' + it.finding + '\n  Need: ' + it.need)); L.push(''); }
    if (sells.length) { L.push('## What it sells and who it serves (' + sells.length + ')', ''); sells.forEach(it => L.push('- ' + it.finding)); L.push(''); }
    const asks = Array.from(new Set(read.items.map(it => it.ask).filter(Boolean))).slice(0, 8);
    const p = E.profile(E.trackOf(tail)); (p.asks || []).forEach(q => { if (asks.length < 8 && !asks.includes(q)) asks.push(q); });
    if (asks.length) L.push('## Questions to ask', '', asks.map(q => '- ' + q).join('\n'), '');
    const flags = [];
    if (a.status !== 'active') flags.push('Status is ' + a.status + (a.successor ? ' (' + a.successor + ')' : '') + ': who would you actually work for, and what changes for clients?');
    if (a.ownership === 'pe-backed') flags.push('Private-equity backed: what are the owners’ expectations for margin and growth?');
    if (a.clients && a.clients.n > 0 && a.clients.observed === 0) flags.push('Every client on record is a name only: which results can be shown, and how are they audited?');
    if (a.horus && a.horus.ok && a.horus.moves && a.horus.moves.P5 === 'unknown') flags.push('No public pricing model: how are engagements priced?');
    if (a.region !== 'US') flags.push('Outside the US: CV conventions differ (length, photo, personal details). Check the posting and the country norm.');
    if (flags.length) L.push('## Things to verify before you say yes', '', flags.map(f => '- ' + f).join('\n'), '');
    if ((a.services || []).length || (a.proprietary || []).length) L.push('## Their words', '', (a.services || []).length ? '- Services: ' + a.services.join(', ') : '', (a.proprietary || []).length ? '- Products (know what they are; do not claim them): ' + a.proprietary.join(', ') : '', '');
    if (read.verticals.length) L.push('## Verticals, and the Leviathan atlases that know them', '', read.verticals.map(v => '- ' + v.label + (v.names.length ? ': ' + v.names.join(', ') : '') + (v.mod ? ' · atlas `#' + v.mod + '`' : '')).join('\n'), '');
    const lint = opts.lint;
    if (lint && lint.claims && lint.claims.length) L.push('## Skills without evidence on the résumé', '', 'Each of these sits in the skills block with no bullet behind it. Add the bullet, or drop the skill:', '', lint.claims.map(c => '- ' + c).join('\n'), '');
    L.push('## Before the interview', '', '- Read the agency’s site and the posting; confirm the title and the level.', '- Check the Dossier in the Core for the dated sources behind each finding: `#core.a.' + a.id + '`' + (a.hb ? ' and the Hit Board: `#hitboard.ten`' : ''), '- Fill every [placeholder] or delete the line; the Forge will not call the résumé ready while one is left.', '- Have one number for each line in your headline.', '');
    if ((a.sources || []).length) L.push('## Sources the Radar read', '', a.sources.map(s => '- ' + s).join('\n'), '');
    return L.join('\n').replace(/\n{3,}/g, '\n\n');
  };

  /* ---------- search over the agencies ---------- */
  E.search = function (q, opts) {
    opts = opts || {};
    const all = E.agencies();
    const words = String(q || '').toLowerCase().split(/\s+/).filter(Boolean);
    const list = all.filter(a => {
      if (opts.wing && !Object.keys(a.wv || {}).some(k => VERT[k] && VERT[k].wing === opts.wing)) return false;
      if (opts.hb && !a.hb) return false;
      if (opts.deep && !a.deep) return false;
      if (opts.region && a.region !== opts.region) return false;
      return true;
    }).map(a => {
      if (!words.length) return { a, s: (a.hb ? 3 : 0) + (a.prom || 0) };
      const name = a.name.toLowerCase(), hay = [a.name, a.domain, a.hq, a.segment, a.archetype, (a.verticals || []).join(' '), (a.services || []).join(' ')].filter(Boolean).join(' ').toLowerCase();
      let s = 0;
      for (const w of words) { if (!hay.includes(w)) return null; s += name === w ? 6 : name.startsWith(w) ? 4 : name.includes(w) ? 3 : (a.domain || '').includes(w) ? 2 : 1; }
      return { a, s: s + (a.prom || 0) };
    }).filter(Boolean);
    list.sort((x, y) => y.s - x.s || x.a.name.localeCompare(y.a.name));
    return list.map(x => x.a).slice(0, opts.limit || 20);
  };

  G.__LV_RESUME_ENGINE = E;
})();
