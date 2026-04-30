-- 0015_client_archives_bucket.sql
-- Creates the private Supabase Storage bucket where hard-delete ZIPs land.
-- A 30-day signed URL is generated server-side at delete time and surfaced
-- to the deleting super-admin via the notifications table.

insert into storage.buckets (id, name, public)
values ('client-archives', 'client-archives', false)
on conflict (id) do nothing;

-- Default-deny RLS on the bucket: no policies = service-role-only access.
-- Server actions use createAdminClient (service-role key) to upload + sign.
-- End-users only ever interact with the resulting signed URL, which is
-- itself bearer-authenticated by Supabase Storage.
