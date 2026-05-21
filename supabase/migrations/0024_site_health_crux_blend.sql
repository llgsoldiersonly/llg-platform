-- 0024_site_health_crux_blend.sql
-- Adds CrUX (Chrome User Experience Report) field data alongside the existing
-- Lighthouse lab metrics in site_health, and a configurable blend weight so
-- the client-facing "Site Health Scores" card can display a 66/34 (default)
-- composite of real-user data + lab simulation.
--
-- CrUX data only exists for sites with enough qualifying Chrome traffic in the
-- last 28 days. When NULL, the display falls back to lab-only.
--
-- See lib/integrations/score-blend.ts for the scoring/blending math.

-- ============================================================================
-- 1. CrUX columns on site_health
-- ============================================================================

alter table site_health
  add column if not exists crux_lcp_ms int,
  add column if not exists crux_inp_ms int,
  add column if not exists crux_cls numeric,
  add column if not exists crux_fcp_ms int,
  -- 'FAST' / 'AVERAGE' / 'SLOW' — Google's published bucket for the URL/origin
  add column if not exists crux_category text;

-- Same columns on the history table.
alter table raw_lighthouse
  add column if not exists crux_lcp_ms int,
  add column if not exists crux_inp_ms int,
  add column if not exists crux_cls numeric,
  add column if not exists crux_fcp_ms int,
  add column if not exists crux_category text;

-- ============================================================================
-- 2. Configurable blend weight on platform_settings
-- ============================================================================
-- weight of CrUX in the final composite when both CrUX and lab are available.
-- 1.0 = CrUX only, 0.0 = lab only, default 0.66 (per product decision).
-- When CrUX is null, the displayed score uses lab-only regardless of weight.

alter table platform_settings
  add column if not exists crux_weight numeric default 0.66
    check (crux_weight >= 0 and crux_weight <= 1);

update platform_settings set crux_weight = 0.66 where crux_weight is null;
