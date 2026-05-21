-- 0027_calls_ai_summary.sql
-- Surface CallRail's AI summary + lead score on each call row so the client
-- portal can show them in a click-to-expand popup. Both fields are already
-- present on the raw CallRail response (raw_callrail.raw_json) — this
-- migration just normalizes them out to dedicated columns and backfills
-- from the existing JSON.

alter table calls
  add column if not exists ai_summary text,
  add column if not exists lead_score int;

alter table raw_callrail
  add column if not exists ai_summary text,
  add column if not exists lead_score int;

-- Backfill from raw_json on raw_callrail.
update raw_callrail
set
  ai_summary = nullif(trim(raw_json->>'lead_explanation'), ''),
  lead_score = case
    when raw_json ? 'lead_score' and (raw_json->>'lead_score') ~ '^[0-9]+$'
      then (raw_json->>'lead_score')::int
    else null
  end
where ai_summary is null
  and raw_json is not null;

-- Backfill calls from raw_callrail (matching on client_id + external_id).
update calls c
set
  ai_summary = rc.ai_summary,
  lead_score = rc.lead_score
from raw_callrail rc
where c.client_id = rc.client_id
  and c.external_id = rc.call_id
  and (c.ai_summary is null or c.lead_score is null);
