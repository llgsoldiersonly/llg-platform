-- 0025_clients_show_site_health.sql
-- Per-client toggle for the Site Health Scores card on the client overview.
-- Defaults to true (visible). Setting false hides the card for that client
-- without affecting any other client.
--
-- Reiersen Law is the first firm using this — their card is hidden per
-- product direction on 2026-05-21. Future toggles for other widgets should
-- either add their own boolean here or migrate to a `hidden_widgets text[]`
-- shape if more than ~2 such toggles accumulate.

alter table clients
  add column if not exists show_site_health boolean not null default true;

-- Hide for Reiersen Law (only firm currently scoped to be hidden).
update clients
set show_site_health = false
where firm_name = 'Reiersen Law';
