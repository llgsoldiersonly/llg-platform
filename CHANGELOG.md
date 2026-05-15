# Changelog

All notable changes per phase. Newest first.

## Phase 2 — Schema + Seed ✅ shipped

**Date:** 2026-04-27
**PR:** [#1](https://github.com/llgsoldiersonly/llg-platform/pull/1) — merged

### Migrations
- **0001** core_schema — profiles, departments, clients (with `is_demo_only`), client_locations (BrightLocal IDs), client_users
- **0002** credentials — `client_credentials` with RLS enabled and zero policies (service-role only)
- **0003** packages_deliverables — templates, modules, deliverables menu, subscriptions, deliverables instance table, `deliverables_display` view
- **0004** raw_tables — `tracked_keywords` + 8 `raw_*` ingestion buffers
- **0005** normalized_tables — 9 deduped tables the app reads
- **0006** tickets_tasks — tickets, messages, routing, tasks, comments
- **0007** sync_log_notifications — sync_log, notifications, activity_log
- **0008** rls_policies — `is_agency_staff()` / `is_super_admin()` / `accessible_client_ids()` helpers + RLS on every tenant-scoped table
- **0009** seed — 11 depts, 5 packages, 93 package_deliverables, 8 routing rules, 7 clients (6 pilots + Acme demo with `is_demo_only=true`), 8 locations (Gilliam gets 2), 9 subscriptions (Daniels and Gilliam each get 2), Olson's free-website incentive
- **0010** auth_trigger — `on_auth_user_created` trigger creates a `profiles` row whenever `auth.users` gets a new entry, with backfill for users created before this trigger existed

### App additions
- **`/api/health`** endpoint — public, returns seed counts via service-role. Used by smoke tests + ops monitoring.
- Middleware excludes `/api/health` so the smoke test can hit it unauthenticated.

### Acceptance
- `pnpm smoke https://llg-platform-llg-team.vercel.app` → **13/13 passing** on production
- Counts verified: 7 clients, 1 demo, 11 depts, 5 packages, 9 subs, 8 locations, 8 routing rules, 1 incentive, 93 deliverables
- RLS verified on preview branch: helper fns present, 35 tenant tables locked, `client_credentials` has 0 policies (service-role only)

### Known follow-ups (NOT bugs)
- Idempotency check via "reset preview branch + reapply" was skipped (would burn ~$0.30 in Branching compute). All inserts use `ON CONFLICT` or `WHERE NOT EXISTS` patterns; will be exercised next time someone re-runs migrations on a fresh DB.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` is scoped to specific git branches in Vercel Preview env (CLI bug prevented "all branches" setting). Each new phase branch will need its own copy added. Workaround documented in PR #1 comments.
- Test users (Part 2.5.4 of the handoff) are NOT seeded — those live in `supabase/seed.sql` for local-only `supabase db reset`. Production gets only the 7 real-client seed rows.

---

## Phase 1 — Foundation ✅ shipped

**Date:** 2026-04-27

### Scaffolding
- Next.js 15.5 + React 19 + TypeScript strict + Tailwind v4 + shadcn-style primitives (`button`, `input`, `card`, `label`)
- Wired Supabase clients (browser/server/service-role) via `@supabase/ssr`
- Host-aware middleware: `ops.*` → admin route group, `llgportal.*` → client route group, magic-link auth gate on every protected path
- `/login` magic-link page with React Hook Form + Zod (Suspense-wrapped for Next 15 prerender)
- `/auth/callback` route exchanges OAuth code for session
- Placeholder `/dashboard` (admin) and `/overview` (client) pages — wired to real data in Phase 3+
- `lib/errors.ts` — `Result<T>` discriminated union + `ErrorCodes` registry + user-facing `errorMessages`
- `lib/features.ts` + `feature_flags` table migration — gates v1.5+ features
- `lib/auth/rbac.ts` — role helpers (`agency_staff` / `client_user` / `super_admin`)
- Sentry config (client / server / edge) + `instrumentation.ts`
- `scripts/smoke-test.sh` — Phase 1 baseline checks; `pnpm smoke` alias
- `supabase/config.toml` — local dev config + auth redirect URLs
- `next.config.ts` — pinned `outputFileTracingRoot` so a stray lockfile in `~` doesn't hijack workspace root

### Infrastructure
- **Repo:** `llgsoldiersonly/llg-platform` (private), default branch `phase-1-foundation`
- **Vercel:** linked to `llg-team/llg-platform`, env vars wired for production + preview + dev, deployed at `https://llg-platform-llg-team.vercel.app`
- **Supabase:** project `ifonutjkbciqtpckynhb`, free tier, magic-link auth verified working
- **Resend:** plugged into Supabase as SMTP (sender `spaceman@llgportal.com`, domain verified)
- **Sentry:** org `llg`, project `llg-platform`, DSN active in production deploys
- **Dev port:** pinned to **3001** (3000 conflicts with local Remotion)

### Acceptance
- `pnpm smoke` → 3/3 passing locally
- `pnpm smoke https://llg-platform-llg-team.vercel.app` → 3/3 passing on deploy
- Magic-link round-trip verified: `nathan.u@lucrativelegal.com` → email → click → `/overview` ✓
- `feature_flags` migration creates `seed_test_flag` + 4 future-feature gates

### Known follow-ups (intentional, NOT bugs)
- Vercel SSO disabled entirely (Option A) — preview deploys publicly accessible. Acceptable: app has Supabase auth in front. Revisit if/when Vercel Pro is added or "Deployment Protection Exceptions" tier is bumped.
- `/admin/settings/feature-flags` UI deferred to Phase 3 (admin shell)
- Custom domains (`llgportal.com`, `ops.legalleadsgroup.com`) not yet wired — happens in Phase 10 launch prep
- First commit attribution shows `nathan.t.unger@gmail.com` (personal Gmail). All commits since use `nathan.u@lucrativelegal.com`. Cosmetic, not force-pushing to fix.

### Required before Phase 2 starts
- **Supabase Free → Pro upgrade ($25/mo)** so Branching is available. Without Branching, every migration would have to hit production Supabase — that's how prod databases die. Pro tier is non-negotiable per `CLAUDE_CODE_HANDOFF.md` Part 2.5.3.
- Path: Supabase dashboard → Settings → Billing → Upgrade to Pro. Then Settings → Branching → Enable. Then GitHub integration for auto-branch-per-PR.
