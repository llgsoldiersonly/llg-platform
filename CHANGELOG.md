# Changelog

All notable changes per phase. Newest first.

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
- **Resend:** plugged into Supabase as SMTP (sender `onboarding@resend.dev` for dev)
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
