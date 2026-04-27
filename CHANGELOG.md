# Changelog

All notable changes per phase. Newest first.

## Phase 1 — Foundation (in progress)

**Date:** 2026-04-27

- Scaffolded Next.js 15 + React 19 + TypeScript strict + Tailwind v4 + shadcn-style primitives
- Wired Supabase clients (browser/server/service-role) via `@supabase/ssr`
- Built host-aware middleware: `ops.llgportal.local` → admin route group, `llgportal.local` → client route group, magic-link auth gate on every protected path
- `/login` magic-link page with React Hook Form + Zod validation
- `/auth/callback` route exchanges OAuth code for session
- Placeholder `/dashboard` (admin) and `/overview` (client) pages — wired to real data in Phase 3+
- `lib/errors.ts` — `Result<T>` discriminated union + `ErrorCodes` registry + user-facing `errorMessages`
- `lib/features.ts` + `feature_flags` table migration — gates v1.5+ features
- `lib/auth/rbac.ts` — role helpers (`agency_staff` / `client_user` / `super_admin`)
- Sentry config (client / server / edge) + `instrumentation.ts` for Next.js 15
- `scripts/smoke-test.sh` — Phase 1 baseline checks; `pnpm smoke` alias
- `supabase/config.toml` — local dev config + auth redirect URLs
- `vercel.json` — empty cron schedule stub (filled in Phase 6)
- `.env.example` — full Phase 1 env var template
