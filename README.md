# LLG Platform

Unified Next.js 15 platform serving Legal Leads Group's law-firm clients (`llgportal.com`) and internal ops team (`ops.legalleadsgroup.com`) from one codebase, host-routed via middleware.

Source of truth: `CLAUDE_CODE_HANDOFF.md` (in `/Users/nathan/Documents/Projects Folder/Projects/LLG Client Dashboard/llgportalhandofffiles/`).

## Local development

### Prerequisites

- Node 20+
- pnpm 10+ (installed via `corepack enable pnpm`)
- Supabase CLI (`/Users/nathan/.local/bin/supabase`)
- An entry in `/etc/hosts` for the two host names:

  ```
  127.0.0.1  llgportal.local
  127.0.0.1  ops.llgportal.local
  ```

### First-time setup

1. Copy `.env.example` to `.env.local` and fill in the values from your password manager. **Use the LLG Supabase project, not personal.**
2. Install deps: `pnpm install`

### Running

```bash
pnpm dev
```

Then open:

- **Client portal:** http://llgportal.local:3001
- **Admin portal:** http://ops.llgportal.local:3001

> Port note: `pnpm dev` runs on **3001**, not the Next.js default 3000, because port 3000 is held by another local project on this machine (Remotion studio). The smoke test defaults to 3001 too.

### Smoke test

```bash
pnpm smoke                                      # tests localhost:3001
pnpm smoke https://preview-url.vercel.app       # tests a deploy
```

## Project structure

```
llg-platform/
├── app/
│   ├── (public)/login/        # magic-link sign in
│   ├── (client)/overview/     # client portal home
│   ├── (admin)/dashboard/     # admin portal home
│   ├── auth/callback/         # Supabase auth callback
│   └── layout.tsx
├── components/ui/             # shadcn primitives
├── lib/
│   ├── supabase/              # browser, server, admin (service-role) clients
│   ├── auth/rbac.ts           # role helpers
│   ├── errors.ts              # Result<T> + error registry
│   ├── features.ts            # feature flag helper
│   └── utils/cn.ts
├── supabase/
│   ├── migrations/            # SQL migrations, run via `supabase db reset`
│   └── config.toml
├── scripts/smoke-test.sh
├── middleware.ts              # host-based routing + auth gate
└── vercel.json                # cron schedule (empty until Phase 6)
```

## Phase status

- [x] **Phase 1** — Foundation (this commit)
- [ ] Phase 2 — Schema (requires Supabase Pro upgrade for Branching)
- [ ] Phase 3 — Admin shell
- [ ] Phase 4 — Client portal shell
- [ ] Phase 5 — Ticketing v1
- [ ] Phase 6 — WordPress / CallRail / Metricool ingestion
- [ ] Phase 7 — BrightLocal Rankings + PSI
- [ ] Phase 8 — BrightLocal Citations + Reviews
- [ ] Phase 9 — Tasks & Workload
- [ ] Phase 10 — Polish + Launch

See `CHANGELOG.md` for what has shipped.
