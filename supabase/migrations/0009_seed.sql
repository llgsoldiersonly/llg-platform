-- 0009_seed.sql
-- Seed data: departments, packages, deliverables menu, ticket routing,
-- and the 6 pilot clients + Acme demo. Idempotent — safe to re-run.
--
-- Test users are NOT seeded here — they live in supabase/seed.sql which
-- only runs on `supabase db reset` (local), never in production.

-- ============================================================================
-- IDEMPOTENCY GUARDS — unique constraints needed so on-conflict works
-- ============================================================================
do $$
begin
  if not exists (
    select 1 from pg_indexes where indexname = 'clients_firm_name_uniq'
  ) then
    alter table clients add constraint clients_firm_name_uniq unique (firm_name);
  end if;
  if not exists (
    select 1 from pg_indexes where indexname = 'package_deliverables_pkg_code_uniq'
  ) then
    alter table package_deliverables add constraint package_deliverables_pkg_code_uniq unique (package_id, code);
  end if;
  if not exists (
    select 1 from pg_indexes where indexname = 'client_locations_client_label_uniq'
  ) then
    alter table client_locations add constraint client_locations_client_label_uniq unique (client_id, label);
  end if;
end$$;

-- ============================================================================
-- DEPARTMENTS
-- ============================================================================
insert into departments (name, slug, description) values
  ('SEO', 'seo', 'On-page and off-page SEO, keywords, content strategy'),
  ('Design', 'design', 'Website design, branding'),
  ('Development', 'development', 'Website build, CMS, custom code'),
  ('Paid Ads', 'paid_ads', 'Google Ads, LSA, retargeting'),
  ('Content', 'content', 'Blogs, videos, press releases'),
  ('Local/GMB', 'local_gmb', 'Google Business Profile, citations, NAP'),
  ('AI/Voice', 'ai_voice', 'FAQ voice search, AI submissions'),
  ('Intakes', 'intakes', '24/7 bilingual intake team'),
  ('Account Management', 'account_mgmt', 'Client success, onboarding'),
  ('Sales', 'sales', 'New client acquisition'),
  ('Finance', 'finance', 'Billing, contracts')
on conflict (slug) do nothing;

-- ============================================================================
-- PACKAGE_TEMPLATES
-- ============================================================================
insert into package_templates (code, display_name, tier_order, monthly_fee_cents, color_hex) values
  ('LIVE_INTAKES', 'Live Intakes',     0, 199900, '#0891B2'),
  ('GRAVITY',      'Gravity Pack',      1, 199900, '#10B981'),
  ('LAPETUS',      'Saturn — Lapetus',  2, 399900, '#F97316'),
  ('RHEA',         'Saturn — Rhea',     3, 599900, '#DC2626'),
  ('TITAN',        'Saturn — Titan',    4, 899900, '#7C3AED')
on conflict (code) do nothing;

-- ============================================================================
-- PACKAGE_MODULES — which UI modules each package enables
-- ============================================================================

-- GRAVITY: Local + GLSA + read-only keywords (no full SEO, no content)
insert into package_modules (package_id, module_code, config)
select id, 'LOCAL_PLAN', '{"gmb_locations":1,"gmb_posts_per_week":3,"nap_directories":100}'::jsonb
from package_templates where code = 'GRAVITY'
on conflict (package_id, module_code) do nothing;

insert into package_modules (package_id, module_code, config)
select id, 'PPC', '{"type":"glsa","mgmt_fee":false,"radius_mi":15}'::jsonb
from package_templates where code = 'GRAVITY'
on conflict (package_id, module_code) do nothing;

insert into package_modules (package_id, module_code, config)
select id, 'KEYWORDS_READONLY', '{"tracking_only":true}'::jsonb
from package_templates where code = 'GRAVITY'
on conflict (package_id, module_code) do nothing;

-- LAPETUS
insert into package_modules (package_id, module_code, config)
select id, 'SEO_PLAN', '{"keyword_limit":20,"inner_pages":20,"min_words_per_page":1000}'::jsonb
from package_templates where code = 'LAPETUS'
on conflict (package_id, module_code) do nothing;

insert into package_modules (package_id, module_code, config)
select id, 'LOCAL_PLAN', '{"gmb_locations":1,"nap_directories":10}'::jsonb
from package_templates where code = 'LAPETUS'
on conflict (package_id, module_code) do nothing;

insert into package_modules (package_id, module_code, config)
select id, 'PPC', '{"type":"google_ads","mgmt_fee":false,"parent_pages":40,"child_pages":50}'::jsonb
from package_templates where code = 'LAPETUS'
on conflict (package_id, module_code) do nothing;

insert into package_modules (package_id, module_code, config)
select id, 'CONTENT', '{"blogs_en":2,"blogs_es":1,"videos_en":1,"videos_es":1,"press_releases":1}'::jsonb
from package_templates where code = 'LAPETUS'
on conflict (package_id, module_code) do nothing;

insert into package_modules (package_id, module_code, config)
select id, 'AI_VOICE', '{"faq_en_es":2,"ai_blogs_en_es":2}'::jsonb
from package_templates where code = 'LAPETUS'
on conflict (package_id, module_code) do nothing;

insert into package_modules (package_id, module_code, config)
select id, 'INTAKES', '{"live_en_es":true}'::jsonb
from package_templates where code = 'LAPETUS'
on conflict (package_id, module_code) do nothing;

-- RHEA
insert into package_modules (package_id, module_code, config)
select id, 'SEO_PLAN', '{"keyword_limit":25,"inner_pages":25,"min_words_per_page":1000}'::jsonb
from package_templates where code = 'RHEA'
on conflict (package_id, module_code) do nothing;

insert into package_modules (package_id, module_code, config)
select id, 'LOCAL_PLAN', '{"gmb_locations":2,"nap_directories":50}'::jsonb
from package_templates where code = 'RHEA'
on conflict (package_id, module_code) do nothing;

insert into package_modules (package_id, module_code, config)
select id, 'PPC', '{"type":"google_ads","mgmt_fee":false,"parent_pages":100,"child_pages":100}'::jsonb
from package_templates where code = 'RHEA'
on conflict (package_id, module_code) do nothing;

insert into package_modules (package_id, module_code, config)
select id, 'CONTENT', '{"blogs_en":3,"blogs_es":3,"videos_en":2,"videos_es":2,"press_releases":1}'::jsonb
from package_templates where code = 'RHEA'
on conflict (package_id, module_code) do nothing;

insert into package_modules (package_id, module_code, config)
select id, 'AI_VOICE', '{"faq_en_es":4,"ai_blogs_en_es":3,"geo_ai_en_es":true,"voice_search_en_es":true}'::jsonb
from package_templates where code = 'RHEA'
on conflict (package_id, module_code) do nothing;

insert into package_modules (package_id, module_code, config)
select id, 'INTAKES', '{"live_en_es":true}'::jsonb
from package_templates where code = 'RHEA'
on conflict (package_id, module_code) do nothing;

-- TITAN
insert into package_modules (package_id, module_code, config)
select id, 'SEO_PLAN', '{"keyword_limit":30,"inner_pages":30,"min_words_per_page":1500}'::jsonb
from package_templates where code = 'TITAN'
on conflict (package_id, module_code) do nothing;

insert into package_modules (package_id, module_code, config)
select id, 'LOCAL_PLAN', '{"gmb_locations":5,"nap_directories":100}'::jsonb
from package_templates where code = 'TITAN'
on conflict (package_id, module_code) do nothing;

insert into package_modules (package_id, module_code, config)
select id, 'PPC', '{"type":"google_ads","mgmt_fee":false,"parent_pages":200,"child_pages":200}'::jsonb
from package_templates where code = 'TITAN'
on conflict (package_id, module_code) do nothing;

insert into package_modules (package_id, module_code, config)
select id, 'CONTENT', '{"blogs_en":4,"blogs_es":4,"videos_en":3,"videos_es":3,"press_releases":2}'::jsonb
from package_templates where code = 'TITAN'
on conflict (package_id, module_code) do nothing;

insert into package_modules (package_id, module_code, config)
select id, 'AI_VOICE', '{"faq_en_es":7,"ai_blogs_en_es":5,"geo_ai_en_es":true,"voice_search_en_es":true}'::jsonb
from package_templates where code = 'TITAN'
on conflict (package_id, module_code) do nothing;

insert into package_modules (package_id, module_code, config)
select id, 'INTAKES', '{"live_en_es":true}'::jsonb
from package_templates where code = 'TITAN'
on conflict (package_id, module_code) do nothing;

-- LIVE_INTAKES (standalone)
insert into package_modules (package_id, module_code, config)
select id, 'INTAKES', '{"live_en_es":true,"after_hours":true}'::jsonb
from package_templates where code = 'LIVE_INTAKES'
on conflict (package_id, module_code) do nothing;

-- ============================================================================
-- PACKAGE_DELIVERABLES — the menu (~80 rows)
-- ============================================================================
-- Helper macro pattern: insert with sub-select on package code,
-- on conflict (package_id, code) do nothing for idempotency.

-- ---------------------------- GRAVITY ----------------------------
insert into package_deliverables (package_id, module_code, department_slug, code, display_name, frequency, target_count, target_unit, sort_order)
select id, 'LOCAL_PLAN', 'local_gmb', 'GMB_POSTS', 'GMB Article Posts', 'weekly', 3, 'posts', 10 from package_templates where code = 'GRAVITY'
on conflict (package_id, code) do nothing;

insert into package_deliverables (package_id, module_code, department_slug, code, display_name, frequency, target_count, target_unit, sort_order)
select id, 'LOCAL_PLAN', 'local_gmb', 'GMB_VIDEO', 'GMB Monthly Video', 'monthly', 1, 'videos', 20 from package_templates where code = 'GRAVITY'
on conflict (package_id, code) do nothing;

insert into package_deliverables (package_id, module_code, department_slug, code, display_name, frequency, target_count, target_unit, sort_order)
select id, 'LOCAL_PLAN', 'local_gmb', 'GMB_OPTIMIZATION', 'GMB Optimization & Maps Submission', 'once', 1, 'setup', 5 from package_templates where code = 'GRAVITY'
on conflict (package_id, code) do nothing;

insert into package_deliverables (package_id, module_code, department_slug, code, display_name, frequency, target_count, target_unit, sort_order)
select id, 'LOCAL_PLAN', 'local_gmb', 'GMB_PRACTICE_AREAS', 'GMB Practice Areas + Services Setup (10+10)', 'once', 20, 'items', 7 from package_templates where code = 'GRAVITY'
on conflict (package_id, code) do nothing;

insert into package_deliverables (package_id, module_code, department_slug, code, display_name, frequency, target_count, target_unit, sort_order)
select id, 'LOCAL_PLAN', 'local_gmb', 'NAP_DIRECTORIES', 'NAP Directory Submissions', 'once', 100, 'directories', 30 from package_templates where code = 'GRAVITY'
on conflict (package_id, code) do nothing;

insert into package_deliverables (package_id, module_code, department_slug, code, display_name, frequency, target_count, target_unit, sort_order)
select id, 'LOCAL_PLAN', 'local_gmb', 'NAP_POWER', 'NAP POWER Submissions', 'once', 50, 'directories', 35 from package_templates where code = 'GRAVITY'
on conflict (package_id, code) do nothing;

insert into package_deliverables (package_id, module_code, department_slug, code, display_name, frequency, target_count, target_unit, sort_order)
select id, 'LOCAL_PLAN', 'local_gmb', 'YAHOO_BING', 'Yahoo + Bing Listing Optimization', 'once', 2, 'listings', 40 from package_templates where code = 'GRAVITY'
on conflict (package_id, code) do nothing;

insert into package_deliverables (package_id, module_code, department_slug, code, display_name, frequency, target_count, target_unit, sort_order)
select id, 'PPC', 'paid_ads', 'GLSA_BUILD', 'GLSA Build & Management', 'ongoing', 1, 'campaign', 50 from package_templates where code = 'GRAVITY'
on conflict (package_id, code) do nothing;

insert into package_deliverables (package_id, module_code, department_slug, code, display_name, frequency, target_count, target_unit, sort_order)
select id, 'CONTENT', 'content', 'BLOG_MONTHLY', 'SEO-optimized blog post', 'monthly', 1, 'posts', 60 from package_templates where code = 'GRAVITY'
on conflict (package_id, code) do nothing;

insert into package_deliverables (package_id, module_code, department_slug, code, display_name, frequency, target_count, target_unit, sort_order)
select id, 'CONTENT', 'content', 'PRESS_RELEASE', 'Press Release (up to 750 backlinks)', 'monthly', 1, 'release', 65 from package_templates where code = 'GRAVITY'
on conflict (package_id, code) do nothing;

insert into package_deliverables (package_id, module_code, department_slug, code, display_name, frequency, target_count, target_unit, sort_order)
select id, 'LOCAL_PLAN', 'local_gmb', 'SOCIAL_LINKING', 'Social Media Linking + Webmaster Tools Setup', 'once', 1, 'setup', 70 from package_templates where code = 'GRAVITY'
on conflict (package_id, code) do nothing;

insert into package_deliverables (package_id, module_code, department_slug, code, display_name, frequency, target_count, target_unit, sort_order)
select id, 'LOCAL_PLAN', 'local_gmb', 'GA_AUDITS', 'Google Analytics Monthly Audits', 'monthly', 1, 'audit', 75 from package_templates where code = 'GRAVITY'
on conflict (package_id, code) do nothing;

insert into package_deliverables (package_id, module_code, department_slug, code, display_name, frequency, target_count, target_unit, sort_order)
select id, 'LOCAL_PLAN', 'local_gmb', 'COMPETITOR_RESEARCH', 'Competitor Research & Market Analysis', 'once', 1, 'report', 80 from package_templates where code = 'GRAVITY'
on conflict (package_id, code) do nothing;

insert into package_deliverables (package_id, module_code, department_slug, code, display_name, frequency, target_count, target_unit, sort_order)
select id, 'LOCAL_PLAN', 'local_gmb', 'LINK_BUILDING', 'High DA/PA Link Building', 'ongoing', 1, 'campaign', 85 from package_templates where code = 'GRAVITY'
on conflict (package_id, code) do nothing;

-- ---------------------------- LAPETUS ----------------------------
insert into package_deliverables (package_id, module_code, department_slug, code, display_name, frequency, target_count, target_unit, sort_order) values
  ((select id from package_templates where code='LAPETUS'), 'SEO_PLAN', 'seo', 'ON_PAGE_SEO', 'Full On-Page SEO', 'ongoing', 1, 'campaign', 5),
  ((select id from package_templates where code='LAPETUS'), 'SEO_PLAN', 'seo', 'TARGET_KEYWORDS', 'Target Keywords', 'ongoing', 20, 'keywords', 10),
  ((select id from package_templates where code='LAPETUS'), 'SEO_PLAN', 'seo', 'INNER_PAGES', 'Optimized Inner Pages (min. 1,000 words)', 'once', 20, 'pages', 15),
  ((select id from package_templates where code='LAPETUS'), 'SEO_PLAN', 'seo', 'TECHNICAL_SEO', 'Technical SEO (Schema, Sitemap, HTTPS, Speed)', 'once', 1, 'audit', 20),
  ((select id from package_templates where code='LAPETUS'), 'SEO_PLAN', 'seo', 'HOMEPAGE_OPT', 'Homepage + Cornerstone Page Optimization', 'once', 1, 'page', 25),
  ((select id from package_templates where code='LAPETUS'), 'SEO_PLAN', 'development', 'CDN_HOSTING', 'CDN Secure Hosting + SSL (12 months)', 'once', 1, 'setup', 30),
  ((select id from package_templates where code='LAPETUS'), 'SEO_PLAN', 'seo', 'MOBILE_STRUCTURED', 'Structured Data & Mobile Optimization', 'ongoing', 1, 'ongoing', 35),
  ((select id from package_templates where code='LAPETUS'), 'SEO_PLAN', 'seo', 'GA_GSC_SETUP', 'Google Analytics + Search Console Install', 'once', 1, 'setup', 40),
  ((select id from package_templates where code='LAPETUS'), 'SEO_PLAN', 'seo', 'RANKING_REPORTS', 'Ranking Reports & Analytics Meetings', 'monthly', 1, 'meeting', 45),
  ((select id from package_templates where code='LAPETUS'), 'SEO_PLAN', 'seo', 'LINK_BUILDING', 'Quality Backlinks from Directories & Citations', 'ongoing', 1, 'ongoing', 50),
  ((select id from package_templates where code='LAPETUS'), 'SEO_PLAN', 'seo', 'COMPETITOR_TRACKING', 'Ongoing Competitor Tracking', 'monthly', 1, 'report', 55),
  ((select id from package_templates where code='LAPETUS'), 'SEO_PLAN', 'development', 'CALL_TRACKING_INSTALL', 'Phone Call Tracking Installation', 'once', 1, 'setup', 60),
  ((select id from package_templates where code='LAPETUS'), 'LOCAL_PLAN', 'local_gmb', 'GMB_OPTIMIZATION', 'Google Maps + GMB Optimization & Submission', 'once', 1, 'setup', 65),
  ((select id from package_templates where code='LAPETUS'), 'LOCAL_PLAN', 'local_gmb', 'NAP_DIRECTORIES', 'NAP Directories + Citations', 'once', 10, 'directories', 70),
  ((select id from package_templates where code='LAPETUS'), 'LOCAL_PLAN', 'local_gmb', 'SOCIAL_LINKING', 'Social Media Profiles Created + Linked', 'once', 1, 'setup', 75),
  ((select id from package_templates where code='LAPETUS'), 'PPC', 'paid_ads', 'GOOGLE_ADS_MGMT', 'Google Ad Campaigns Build & Management', 'ongoing', 1, 'campaign', 80),
  ((select id from package_templates where code='LAPETUS'), 'PPC', 'paid_ads', 'GLSA_MGMT', 'GLSA Development & Management', 'ongoing', 1, 'campaign', 85),
  ((select id from package_templates where code='LAPETUS'), 'PPC', 'paid_ads', 'GEO_RETARGET', 'Geotargeting + Retargeting with Talk-to-Search', 'once', 1, 'campaign', 90),
  ((select id from package_templates where code='LAPETUS'), 'PPC', 'paid_ads', 'PARENT_SEO_PAGES', 'Parent SEO Pages (20 EN + 20 ES)', 'once', 40, 'pages', 95),
  ((select id from package_templates where code='LAPETUS'), 'PPC', 'paid_ads', 'CHILD_SEO_PAGES', 'Child SEO Pages (25 EN + 25 ES)', 'once', 50, 'pages', 100),
  ((select id from package_templates where code='LAPETUS'), 'PPC', 'paid_ads', 'CASE_LEAD_GEN', 'Case Lead Generation Campaign', 'ongoing', 1, 'campaign', 105),
  ((select id from package_templates where code='LAPETUS'), 'PPC', 'paid_ads', 'LEAD_FUNNEL', 'GMB Location Lead Funnel', 'once', 1, 'funnel', 110),
  ((select id from package_templates where code='LAPETUS'), 'CONTENT', 'content', 'BLOG_EN', 'English Blog Posts', 'monthly', 2, 'posts', 115),
  ((select id from package_templates where code='LAPETUS'), 'CONTENT', 'content', 'BLOG_ES', 'Spanish Blog Posts', 'monthly', 1, 'posts', 120),
  ((select id from package_templates where code='LAPETUS'), 'CONTENT', 'content', 'VIDEO_EN', 'English YouTube Video Blog', 'monthly', 1, 'videos', 125),
  ((select id from package_templates where code='LAPETUS'), 'CONTENT', 'content', 'VIDEO_ES', 'Spanish YouTube Video Blog', 'monthly', 1, 'videos', 130),
  ((select id from package_templates where code='LAPETUS'), 'CONTENT', 'content', 'PRESS_RELEASE', 'Off-Page Press Release', 'monthly', 1, 'release', 135),
  ((select id from package_templates where code='LAPETUS'), 'CONTENT', 'content', 'SOCIAL_DAILY', 'Social Media Marketing + Daily Posts', 'ongoing', 1, 'ongoing', 140),
  ((select id from package_templates where code='LAPETUS'), 'CONTENT', 'content', 'BLOG_IMG_OPT', 'Monthly Blog + Image Optimization', 'monthly', 1, 'audit', 145),
  ((select id from package_templates where code='LAPETUS'), 'AI_VOICE', 'ai_voice', 'FAQ_VOICE_EN_ES', 'FAQ Voice Search Blogs (EN + ES)', 'monthly', 2, 'posts', 150),
  ((select id from package_templates where code='LAPETUS'), 'AI_VOICE', 'ai_voice', 'AI_BLOGS_EN_ES', 'AI Search Blogs (EN + ES)', 'monthly', 2, 'posts', 155),
  ((select id from package_templates where code='LAPETUS'), 'AI_VOICE', 'ai_voice', 'MANUAL_INDEXING', 'Manual Indexing to Search Console + AI Submissions', 'ongoing', 1, 'ongoing', 160),
  ((select id from package_templates where code='LAPETUS'), 'INTAKES', 'intakes', 'LIVE_INTAKES', 'Live EN/ES Intakes (24/7)', 'ongoing', 1, 'ongoing', 165),
  ((select id from package_templates where code='LAPETUS'), 'INTAKES', 'intakes', 'LEAD_VERIFY', 'Lead Verification + Retainer Doc System', 'once', 1, 'setup', 170),
  ((select id from package_templates where code='LAPETUS'), 'INTAKES', 'intakes', 'CASE_CONVERSION', 'Case Conversion System (EN + ES)', 'once', 1, 'setup', 175),
  ((select id from package_templates where code='LAPETUS'), 'INTAKES', 'intakes', 'INTAKE_SOFTWARE', 'Intake Software Installed on Website', 'once', 1, 'setup', 180)
on conflict (package_id, code) do nothing;

-- ---------------------------- RHEA ----------------------------
insert into package_deliverables (package_id, module_code, department_slug, code, display_name, frequency, target_count, target_unit, sort_order) values
  ((select id from package_templates where code='RHEA'), 'SEO_PLAN', 'seo', 'ON_PAGE_SEO', 'Full On-Page SEO', 'ongoing', 1, 'campaign', 5),
  ((select id from package_templates where code='RHEA'), 'SEO_PLAN', 'seo', 'TARGET_KEYWORDS', 'Target Keywords', 'ongoing', 25, 'keywords', 10),
  ((select id from package_templates where code='RHEA'), 'SEO_PLAN', 'seo', 'INNER_PAGES', 'Optimized Inner Pages (min. 1,000 words)', 'once', 25, 'pages', 15),
  ((select id from package_templates where code='RHEA'), 'SEO_PLAN', 'seo', 'TECHNICAL_SEO', 'Technical SEO', 'once', 1, 'audit', 20),
  ((select id from package_templates where code='RHEA'), 'SEO_PLAN', 'seo', 'HOMEPAGE_OPT', 'Homepage + Cornerstone Optimization', 'once', 1, 'page', 25),
  ((select id from package_templates where code='RHEA'), 'SEO_PLAN', 'development', 'CDN_HOSTING', 'CDN Secure Hosting + SSL', 'once', 1, 'setup', 30),
  ((select id from package_templates where code='RHEA'), 'SEO_PLAN', 'seo', 'RANKING_REPORTS', 'Ranking Reports & Meetings', 'monthly', 1, 'meeting', 45),
  ((select id from package_templates where code='RHEA'), 'LOCAL_PLAN', 'local_gmb', 'GMB_OPTIMIZATION', 'GMB + Google Maps Optimization', 'once', 2, 'locations', 65),
  ((select id from package_templates where code='RHEA'), 'LOCAL_PLAN', 'local_gmb', 'NAP_DIRECTORIES', 'NAP Directories + Citations', 'once', 50, 'directories', 70),
  ((select id from package_templates where code='RHEA'), 'PPC', 'paid_ads', 'GOOGLE_ADS_MGMT', 'Google Ads Build & Management', 'ongoing', 1, 'campaign', 80),
  ((select id from package_templates where code='RHEA'), 'PPC', 'paid_ads', 'PARENT_SEO_PAGES', 'Parent SEO Pages (50 EN + 50 ES)', 'once', 100, 'pages', 95),
  ((select id from package_templates where code='RHEA'), 'PPC', 'paid_ads', 'CHILD_SEO_PAGES', 'Child SEO Pages (50 EN + 50 ES)', 'once', 100, 'pages', 100),
  ((select id from package_templates where code='RHEA'), 'PPC', 'paid_ads', 'LEAD_FUNNEL', 'GMB Location Lead Funnels', 'once', 2, 'funnels', 110),
  ((select id from package_templates where code='RHEA'), 'CONTENT', 'content', 'BLOG_EN', 'English Blog Posts', 'monthly', 3, 'posts', 115),
  ((select id from package_templates where code='RHEA'), 'CONTENT', 'content', 'BLOG_ES', 'Spanish Blog Posts', 'monthly', 3, 'posts', 120),
  ((select id from package_templates where code='RHEA'), 'CONTENT', 'content', 'VIDEO_EN', 'English YouTube Video Blogs', 'monthly', 2, 'videos', 125),
  ((select id from package_templates where code='RHEA'), 'CONTENT', 'content', 'VIDEO_ES', 'Spanish YouTube Video Blogs', 'monthly', 2, 'videos', 130),
  ((select id from package_templates where code='RHEA'), 'CONTENT', 'content', 'PRESS_RELEASE', 'Off-Page Press Release', 'monthly', 1, 'release', 135),
  ((select id from package_templates where code='RHEA'), 'AI_VOICE', 'ai_voice', 'FAQ_VOICE_EN_ES', 'FAQ Voice Search Blogs (EN + ES)', 'monthly', 4, 'posts', 150),
  ((select id from package_templates where code='RHEA'), 'AI_VOICE', 'ai_voice', 'AI_BLOGS_EN_ES', 'AI Search Blogs (EN + ES)', 'monthly', 3, 'posts', 155),
  ((select id from package_templates where code='RHEA'), 'AI_VOICE', 'ai_voice', 'GEO_AI_EN_ES', 'Geotargeted AI Submissions (EN + ES)', 'ongoing', 1, 'ongoing', 158),
  ((select id from package_templates where code='RHEA'), 'AI_VOICE', 'ai_voice', 'VOICE_SEARCH_EN_ES', 'Voice Search Submissions (EN + ES)', 'ongoing', 1, 'ongoing', 159),
  ((select id from package_templates where code='RHEA'), 'INTAKES', 'intakes', 'LIVE_INTAKES', 'Live EN/ES Intakes (24/7)', 'ongoing', 1, 'ongoing', 165)
on conflict (package_id, code) do nothing;

-- ---------------------------- TITAN ----------------------------
insert into package_deliverables (package_id, module_code, department_slug, code, display_name, frequency, target_count, target_unit, sort_order) values
  ((select id from package_templates where code='TITAN'), 'SEO_PLAN', 'seo', 'ON_PAGE_SEO', 'Full On-Page SEO', 'ongoing', 1, 'campaign', 5),
  ((select id from package_templates where code='TITAN'), 'SEO_PLAN', 'seo', 'TARGET_KEYWORDS', 'Target Keywords', 'ongoing', 30, 'keywords', 10),
  ((select id from package_templates where code='TITAN'), 'SEO_PLAN', 'seo', 'INNER_PAGES', 'Optimized Inner Pages (min. 1,500 words)', 'once', 30, 'pages', 15),
  ((select id from package_templates where code='TITAN'), 'LOCAL_PLAN', 'local_gmb', 'GMB_OPTIMIZATION', 'GMB + Google Maps (up to 5 locations)', 'once', 5, 'locations', 65),
  ((select id from package_templates where code='TITAN'), 'LOCAL_PLAN', 'local_gmb', 'NAP_DIRECTORIES', 'NAP Directories + Citations', 'once', 100, 'directories', 70),
  ((select id from package_templates where code='TITAN'), 'PPC', 'paid_ads', 'PARENT_SEO_PAGES', 'Parent SEO Pages (100 EN + 100 ES)', 'once', 200, 'pages', 95),
  ((select id from package_templates where code='TITAN'), 'PPC', 'paid_ads', 'CHILD_SEO_PAGES', 'Child SEO Pages (100 EN + 100 ES)', 'once', 200, 'pages', 100),
  ((select id from package_templates where code='TITAN'), 'PPC', 'paid_ads', 'LEAD_FUNNEL', 'GMB Location Lead Funnels', 'once', 5, 'funnels', 110),
  ((select id from package_templates where code='TITAN'), 'CONTENT', 'content', 'BLOG_EN', 'English Blog Posts', 'monthly', 4, 'posts', 115),
  ((select id from package_templates where code='TITAN'), 'CONTENT', 'content', 'BLOG_ES', 'Spanish Blog Posts', 'monthly', 4, 'posts', 120),
  ((select id from package_templates where code='TITAN'), 'CONTENT', 'content', 'VIDEO_EN', 'English YouTube Video Blogs', 'monthly', 3, 'videos', 125),
  ((select id from package_templates where code='TITAN'), 'CONTENT', 'content', 'VIDEO_ES', 'Spanish YouTube Video Blogs', 'monthly', 3, 'videos', 130),
  ((select id from package_templates where code='TITAN'), 'CONTENT', 'content', 'PRESS_RELEASE', 'Off-Page Press Releases', 'monthly', 2, 'releases', 135),
  ((select id from package_templates where code='TITAN'), 'AI_VOICE', 'ai_voice', 'FAQ_VOICE_EN_ES', 'FAQ Voice Search Blogs (EN + ES)', 'monthly', 7, 'posts', 150),
  ((select id from package_templates where code='TITAN'), 'AI_VOICE', 'ai_voice', 'AI_BLOGS_EN_ES', 'AI Search Blogs (EN + ES)', 'monthly', 5, 'posts', 155),
  ((select id from package_templates where code='TITAN'), 'AI_VOICE', 'ai_voice', 'GEO_AI_EN_ES', 'Geotargeted AI Submissions (EN + ES)', 'ongoing', 1, 'ongoing', 158),
  ((select id from package_templates where code='TITAN'), 'AI_VOICE', 'ai_voice', 'VOICE_SEARCH_EN_ES', 'Voice Search Submissions (EN + ES)', 'ongoing', 1, 'ongoing', 159),
  ((select id from package_templates where code='TITAN'), 'INTAKES', 'intakes', 'LIVE_INTAKES', 'Live EN/ES Intakes (24/7)', 'ongoing', 1, 'ongoing', 165)
on conflict (package_id, code) do nothing;

-- ---------------------------- LIVE_INTAKES ----------------------------
insert into package_deliverables (package_id, module_code, department_slug, code, display_name, frequency, target_count, target_unit, sort_order) values
  ((select id from package_templates where code='LIVE_INTAKES'), 'INTAKES', 'intakes', 'LIVE_INTAKES_247', '24/7 Bilingual Live Intakes (EN + ES)', 'ongoing', 1, 'ongoing', 10),
  ((select id from package_templates where code='LIVE_INTAKES'), 'INTAKES', 'intakes', 'AFTER_HOURS', 'After-Hours Answering', 'ongoing', 1, 'ongoing', 20)
on conflict (package_id, code) do nothing;

-- ============================================================================
-- TRACKING-SOURCE OVERRIDES — auto-reconcile vs manual per spec section 3.12
-- ============================================================================

-- BLOG_EN / BLOG_ES start MANUAL until admin sets language detection method
-- per client (in client_credentials.wp_language_method); see spec section 3.6.
update package_deliverables set
  tracking_source = 'manual',
  matcher_config = '{"language":"en","resolve_from":"client_credentials"}'::jsonb
where code = 'BLOG_EN';

update package_deliverables set
  tracking_source = 'manual',
  matcher_config = '{"language":"es","resolve_from":"client_credentials"}'::jsonb
where code = 'BLOG_ES';

-- GRAVITY's single monthly blog (no language split)
update package_deliverables set
  tracking_source = 'wp_post',
  matcher_config = '{"post_type":"post"}'::jsonb
where code = 'BLOG_MONTHLY';

-- FAQ Voice Search → auto from posts in 'faqs' category, active starting May 1, 2026
update package_deliverables set
  tracking_source = 'wp_post',
  matcher_config = '{"post_type":"post","taxonomy":"category","term_slug":"faqs"}'::jsonb
where code = 'FAQ_VOICE_EN_ES';

-- AI Search Blogs stay MANUAL — same posts as FAQ but separate AI submission step
update package_deliverables set
  tracking_source = 'manual',
  matcher_config = '{}'::jsonb
where code = 'AI_BLOGS_EN_ES';

-- Optimized inner pages → count WP pages with meta_key = 'llg_optimized'
update package_deliverables set
  tracking_source = 'wp_post',
  matcher_config = '{"post_type":"page","meta_key":"llg_optimized","meta_value":"true"}'::jsonb
where code = 'INNER_PAGES';

-- Social media daily posts → sum Metricool posts_count across configured channels
update package_deliverables set
  tracking_source = 'social_post',
  matcher_config = '{"channels":["facebook","instagram","twitter","linkedin"]}'::jsonb
where code = 'SOCIAL_DAILY';

-- GMB posts → attempt auto from GBP API, fall back to manual if API not approved
update package_deliverables set
  tracking_source = 'gbp_post',
  matcher_config = '{"source_field":"posts_30d"}'::jsonb
where code = 'GMB_POSTS';

-- ============================================================================
-- TICKET ROUTING RULES
-- ============================================================================
insert into ticket_routing_rules (category, department_id, active)
select 'seo',     d.id, true from departments d where d.slug = 'seo'
on conflict (category) do nothing;

insert into ticket_routing_rules (category, department_id, active)
select 'design',  d.id, true from departments d where d.slug = 'design'
on conflict (category) do nothing;

insert into ticket_routing_rules (category, department_id, active)
select 'dev',     d.id, true from departments d where d.slug = 'development'
on conflict (category) do nothing;

insert into ticket_routing_rules (category, department_id, active)
select 'ads',     d.id, true from departments d where d.slug = 'paid_ads'
on conflict (category) do nothing;

insert into ticket_routing_rules (category, department_id, active)
select 'content', d.id, true from departments d where d.slug = 'content'
on conflict (category) do nothing;

insert into ticket_routing_rules (category, department_id, active)
select 'intakes', d.id, true from departments d where d.slug = 'intakes'
on conflict (category) do nothing;

insert into ticket_routing_rules (category, department_id, active)
select 'billing', d.id, true from departments d where d.slug = 'finance'
on conflict (category) do nothing;

insert into ticket_routing_rules (category, department_id, active)
select 'other',   d.id, true from departments d where d.slug = 'account_mgmt'
on conflict (category) do nothing;

-- ============================================================================
-- THE 6 PILOT CLIENTS + ACME DEMO
-- ============================================================================
insert into clients (firm_name, primary_domain, primary_contact_email, primary_contact_name, vertical, status, onboarded_at, is_demo_only) values
  ('Olson Law Office PC', 'greatfallscriminaldefenseattorney.com', 'Danna@kenolsonlaw.com', 'Danna',          'Criminal Defense',     'onboarding', current_date, false),
  ('Movahedi Law',        'movahedilaw.com',                     'babak@movahedilaw.com', 'Babak Movahedi', 'Immigration',          'active',     current_date, false),
  ('Daniels Law PA',      'danielslawpa.com',                    'tad@danielslawpa.com',  'Tad Daniels',    'Family Law',           'active',     current_date, false),
  ('Gilliam Law',         'sgilliamlaw.com',                     'david@sgilliamlaw.com', 'David Gilliam',  'Immigration',          'active',     current_date, false),
  ('Reiersen Law',        'rrinjurylaw.com',                     'brandon@rrinjurylaw.com','Brandon Reiersen','Personal Injury',     'active',     current_date, false),
  ('Dooley Noted',        'dooleynoted.com',                     'michael@dooleynoted.com','Michael Dooley','Probate/Immigration',  'active',     current_date, false),
  ('Acme Legal Test',     'acme-legal-demo.example.com',         'demo@lucrativelegal.com','Acme Demo',     'Personal Injury',      'active',     current_date, true)
on conflict (firm_name) do nothing;

-- ============================================================================
-- LOCATIONS (Gilliam gets two; others get one)
-- ============================================================================
insert into client_locations (client_id, label, city, state, is_primary)
select c.id, 'Great Falls HQ',       'Great Falls', 'MT', true from clients c where c.firm_name = 'Olson Law Office PC'
on conflict (client_id, label) do nothing;

insert into client_locations (client_id, label, city, state, is_primary)
select c.id, 'DC HQ',                'Washington',  'DC', true from clients c where c.firm_name = 'Movahedi Law'
on conflict (client_id, label) do nothing;

insert into client_locations (client_id, label, city, state, is_primary)
select c.id, 'Ft. Myers HQ',         'Fort Myers',  'FL', true from clients c where c.firm_name = 'Daniels Law PA'
on conflict (client_id, label) do nothing;

insert into client_locations (client_id, label, city, state, is_primary)
select c.id, 'Chicago HQ',           'Chicago',     'IL', true  from clients c where c.firm_name = 'Gilliam Law'
on conflict (client_id, label) do nothing;

insert into client_locations (client_id, label, city, state, is_primary)
select c.id, 'Tennessee Satellite',  'Nashville',   'TN', false from clients c where c.firm_name = 'Gilliam Law'
on conflict (client_id, label) do nothing;

insert into client_locations (client_id, label, city, state, is_primary)
select c.id, 'Kennewick HQ',         'Kennewick',   'WA', true from clients c where c.firm_name = 'Reiersen Law'
on conflict (client_id, label) do nothing;

insert into client_locations (client_id, label, city, state, is_primary)
select c.id, 'Austin HQ',            'Austin',      'TX', true from clients c where c.firm_name = 'Dooley Noted'
on conflict (client_id, label) do nothing;

insert into client_locations (client_id, label, city, state, is_primary)
select c.id, 'LA HQ (Demo)',         'Los Angeles', 'CA', true from clients c where c.firm_name = 'Acme Legal Test'
on conflict (client_id, label) do nothing;

-- ============================================================================
-- SUBSCRIPTIONS — package per client/location
-- ============================================================================
-- Olson: Gravity (onboarding)
insert into subscriptions (client_id, package_id, location_id, status, started_at)
select c.id, p.id, l.id, 'onboarding', current_date
from clients c
join package_templates p on p.code = 'GRAVITY'
join client_locations l on l.client_id = c.id and l.label = 'Great Falls HQ'
where c.firm_name = 'Olson Law Office PC'
  and not exists (
    select 1 from subscriptions s
    where s.client_id = c.id and s.package_id = p.id and s.location_id = l.id
  );

-- Movahedi: LAPETUS
insert into subscriptions (client_id, package_id, location_id, status, started_at)
select c.id, p.id, l.id, 'active', current_date
from clients c
join package_templates p on p.code = 'LAPETUS'
join client_locations l on l.client_id = c.id and l.label = 'DC HQ'
where c.firm_name = 'Movahedi Law'
  and not exists (
    select 1 from subscriptions s
    where s.client_id = c.id and s.package_id = p.id and s.location_id = l.id
  );

-- Daniels: Gravity + Live Intakes
insert into subscriptions (client_id, package_id, location_id, status, started_at)
select c.id, p.id, l.id, 'active', current_date
from clients c
join package_templates p on p.code = 'GRAVITY'
join client_locations l on l.client_id = c.id and l.label = 'Ft. Myers HQ'
where c.firm_name = 'Daniels Law PA'
  and not exists (
    select 1 from subscriptions s
    where s.client_id = c.id and s.package_id = p.id and s.location_id = l.id
  );

insert into subscriptions (client_id, package_id, status, started_at)
select c.id, p.id, 'active', current_date
from clients c, package_templates p
where c.firm_name = 'Daniels Law PA' and p.code = 'LIVE_INTAKES'
  and not exists (
    select 1 from subscriptions s
    where s.client_id = c.id and s.package_id = p.id
  );

-- Gilliam: LAPETUS (Chicago) + GRAVITY (Tennessee)
insert into subscriptions (client_id, package_id, location_id, status, started_at)
select c.id, p.id, l.id, 'active', current_date
from clients c
join package_templates p on p.code = 'LAPETUS'
join client_locations l on l.client_id = c.id and l.label = 'Chicago HQ'
where c.firm_name = 'Gilliam Law'
  and not exists (
    select 1 from subscriptions s
    where s.client_id = c.id and s.package_id = p.id and s.location_id = l.id
  );

insert into subscriptions (client_id, package_id, location_id, status, started_at)
select c.id, p.id, l.id, 'active', current_date
from clients c
join package_templates p on p.code = 'GRAVITY'
join client_locations l on l.client_id = c.id and l.label = 'Tennessee Satellite'
where c.firm_name = 'Gilliam Law'
  and not exists (
    select 1 from subscriptions s
    where s.client_id = c.id and s.package_id = p.id and s.location_id = l.id
  );

-- Reiersen: RHEA
insert into subscriptions (client_id, package_id, location_id, status, started_at)
select c.id, p.id, l.id, 'active', current_date
from clients c
join package_templates p on p.code = 'RHEA'
join client_locations l on l.client_id = c.id and l.label = 'Kennewick HQ'
where c.firm_name = 'Reiersen Law'
  and not exists (
    select 1 from subscriptions s
    where s.client_id = c.id and s.package_id = p.id and s.location_id = l.id
  );

-- Dooley: RHEA
insert into subscriptions (client_id, package_id, location_id, status, started_at)
select c.id, p.id, l.id, 'active', current_date
from clients c
join package_templates p on p.code = 'RHEA'
join client_locations l on l.client_id = c.id and l.label = 'Austin HQ'
where c.firm_name = 'Dooley Noted'
  and not exists (
    select 1 from subscriptions s
    where s.client_id = c.id and s.package_id = p.id and s.location_id = l.id
  );

-- Acme demo: TITAN (full feature exposure)
insert into subscriptions (client_id, package_id, location_id, status, started_at)
select c.id, p.id, l.id, 'active', current_date
from clients c
join package_templates p on p.code = 'TITAN'
join client_locations l on l.client_id = c.id and l.label = 'LA HQ (Demo)'
where c.firm_name = 'Acme Legal Test'
  and not exists (
    select 1 from subscriptions s
    where s.client_id = c.id and s.package_id = p.id and s.location_id = l.id
  );

-- ============================================================================
-- OLSON INCENTIVE — "free basic website" attached as a custom deliverable
-- ============================================================================
-- Demonstrates the custom/incentive deliverable pattern (template_id null,
-- source='incentive', is_incentive=true → renders with "Free Bonus" badge).
insert into deliverables (
  subscription_id, template_id,
  custom_title, custom_description, custom_department_slug,
  custom_frequency, custom_target_count, custom_target_unit,
  source, is_incentive,
  period_start, period_end, status
)
select s.id, null,
  'Basic Website Build',
  'Single-page basic website provided free as a sign-up incentive for Gravity Pack. Domain: greatfallscriminaldefenseattorney.com',
  'design',
  'once', 1, 'site',
  'incentive', true,
  current_date, current_date + interval '30 days', 'in_progress'
from subscriptions s
join clients c on c.id = s.client_id
join package_templates p on p.id = s.package_id
where c.firm_name = 'Olson Law Office PC' and p.code = 'GRAVITY'
  and not exists (
    select 1 from deliverables d
    where d.subscription_id = s.id and d.custom_title = 'Basic Website Build'
  );
