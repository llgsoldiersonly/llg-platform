# LLG Platform — Engineering Handoff

**As of:** 2026-05-22
**Author:** Generated handoff after the May 14–22 build sprint
**Repo:** [github.com/llgsoldiersonly/llg-platform](https://github.com/llgsoldiersonly/llg-platform)
**Production URL:** [llgportal.com](https://llgportal.com)
**Hosted on:** Vercel (`llg-team/llg-platform`)

---

## 1. Project Overview

### What it is

`llg-platform` is a multi-tenant client portal for **Lucrative Legal Group (LLG)**, a digital-marketing agency serving law firms. It surfaces SEO, GBP, paid-ads, and call-tracking activity per firm, plus an operational layer for the agency staff who deliver the work.

Three audiences, three role-gated experiences:

| Audience | Role | Lands at | Sees |
|---|---|---|---|
| Firm principals + staff | `client_user` | `/overview` | Their own firm's data only (RLS-enforced) |
| LLG agency staff (writers, GBP ops, ads) | `agency_staff` | `/staff` | A single submission form to log completed work |
| LLG super_admins (Nathan, Nick, Brittany, Marissa, Jon) | `super_admin` | `/admin/*` | Full cross-firm management, including impersonation |

### Current status

**Live in production with 6 active firms**: Daniels Law PA, Dooley Noted, Gilliam Law, Movahedi Law, Olson Law Office PC, Reiersen Law. The agency is operationally dependent on it — staff submit work daily, clients check their dashboards.

The May 14–22 sprint shipped 15 production PRs covering: deliverables UI, calls widget with AI summaries, site-health blending with CrUX, per-client widget toggles, submission ergonomics, and a handful of bug fixes. Detailed in §4.

---

## 2. Architecture & Tech Stack

### Stack

| Layer | Choice |
|---|---|
| Framework | **Next.js 15** (App Router, RSC-first, server actions) |
| Runtime | Node.js on Vercel serverless |
| Database | **Supabase Postgres** (project `ifonutjkbciqtpckynhb`) |
| Auth | **Supabase Auth** (magic-link via Resend, `spaceman@llgportal.com`) |
| UI | Tailwind CSS + Radix UI primitives + custom design tokens |
| Email | Resend (transactional only — auth magic links) |
| Storage | Vercel Blob (`5mqokpkfed2vbwak.public.blob.vercel-storage.com`) for tutorial videos |
| Background jobs | Vercel Cron (14 jobs in `vercel.json`) |
| External integrations | CallRail, DataForSEO, Google PageSpeed Insights (PSI), WordPress (planned via Pabbly), Google My Business (via DFS), RingCentral Glip (webhooks) |

### Key patterns

- **Row Level Security (RLS) is the security model.** Every client-facing query is gated by `accessible_client_ids()` in [supabase/migrations/0008_rls_policies.sql](supabase/migrations/0008_rls_policies.sql). Cross-firm reads are physically impossible at the SQL level — middleware and component-level checks are defense in depth, not the primary boundary.
- **Server components + server actions** for all data ops. No client-side Supabase queries; the admin client (`createAdminClient()` in `lib/supabase/admin.ts`) is service-role only and lives behind server actions.
- **Crons are idempotent.** Every cron upserts on a stable key (`client_id + external_id`, etc.) so manual re-fires are safe.
- **Raw + normalized tables.** Most external integrations have a `raw_*` table that stores the full API response as JSONB + a normalized table the UI queries from. Re-derivation is possible from `raw_*` without re-hitting the external API — used for backfills.
- **Discriminator strings, not enums** for things expected to grow (`submission_kind`, `tag`, `status`). Constants live in code (`lib/submissions/kinds.ts`) so adding a new value is a single PR, not a migration.

### Directory map

```
app/
  (client)/        — client-facing portal (/overview, /plan, /seo, /tickets)
  (public)/login   — magic-link auth flow
  admin/           — super_admin tools (clients, deliverables, submissions, system health)
  staff/           — agency_staff submission workspace
  api/
    cron/          — 14 cron route handlers (lighthouse, callrail, etc.)
    webhooks/      — Pabbly + Glip inbound
components/
  client/cards/    — the 12+ cards composing /overview
  admin/           — admin layout, sidebars, switcher
  ui/              — Radix-wrapped primitives (Dialog, Select, Button, etc.)
lib/
  actions/         — server actions (submissions, deliverables, credentials, invites, tickets)
  integrations/    — external API clients (callrail, psi, dataforseo, ringcentral, resend)
  submissions/     — kind registry + helpers
  calls/           — status derivation
  supabase/        — server + admin clients
supabase/
  migrations/      — 28 numbered SQL migrations
scripts/           — one-off provisioning + smoke tests
```

---

## 3. Setup Instructions

### Prerequisites

- Node 22+ (`v24.x` works; check `.nvmrc` if present)
- **pnpm 10+** (the project uses pnpm, not npm)
- Access to the Vercel project + the Supabase project (see §7)
- `vercel` CLI authed to the `llg-team` scope
- `gh` CLI authed for PR work

### Local bootstrap

```bash
git clone git@github.com:llgsoldiersonly/llg-platform.git
cd llg-platform
pnpm install

# Pull production env vars (read-only — for local dev, use --environment=development)
vercel env pull .env.local

# Verify the env file has at minimum:
#   NEXT_PUBLIC_SUPABASE_URL
#   NEXT_PUBLIC_SUPABASE_ANON_KEY
#   SUPABASE_SERVICE_ROLE_KEY
#   CRON_SECRET
#   CALLRAIL_API_TOKEN, CALLRAIL_DEFAULT_ACCOUNT_ID
#   DATAFORSEO_LOGIN, DATAFORSEO_PASSWORD
#   PSI_API_KEY  (production-only by default)
#   BLOB_READ_WRITE_TOKEN

pnpm dev        # → http://localhost:3001 (note: 3001, NOT 3000)
```

### Useful npm scripts

```
pnpm dev          # next dev -p 3001
pnpm dev:fresh    # clears .next/ first (useful after schema changes)
pnpm build        # production build
pnpm typecheck    # tsc --noEmit
pnpm lint         # eslint (currently broken — see Known Issues)
pnpm test         # vitest run
pnpm seed:demo    # seeds the Acme Legal Test demo firm
```

### Provisioning a user (one-off, when admin UI isn't enough)

The `scripts/` folder has three patterns. All run via `pnpm tsx --env-file=.env.local scripts/<name>.ts`:

- `grant-super-admin.ts <email> "<full_name>"` — minted from this session for Jon Kennedy
- `grant-staff-user.ts <email> "<full_name>"` — used for Emma Pratt and the 6 agency staff
- `invite-super-admin.ts <email>` — sends a Supabase Auth invite email

These bypass the admin UI and generate a 1-hour single-use magic-link URL. Useful when first-touch email delivery is unreliable (see Known Issues → GoDaddy AES).

---

## 4. Current Progress (May 14–22 Sprint)

### Shipped on `main`

15 PRs squash-merged in the last 9 days. Reverse chronological:

| PR | Title | Migration | Behavioral note |
|---|---|---|---|
| [#27](https://github.com/llgsoldiersonly/llg-platform/pull/27) | Submissions: add Video kind | — | `video` Kind matches `VIDEO_*` codes |
| [#26](https://github.com/llgsoldiersonly/llg-platform/pull/26) | Submissions: filter Counts toward by Kind | `0028` | Dropdown narrows by submission Kind |
| [#25](https://github.com/llgsoldiersonly/llg-platform/pull/25) | Monthly Production: hide Social posts for Gravity | — | Per-package row hiding |
| [#24](https://github.com/llgsoldiersonly/llg-platform/pull/24) | Move Support & Tickets to left column | — | Layout rebalance after Calls widget added |
| [#23](https://github.com/llgsoldiersonly/llg-platform/pull/23) | Calls widget: AI summary popup on click | `0027` | Click-to-modal with CallRail `lead_explanation` |
| [#22](https://github.com/llgsoldiersonly/llg-platform/pull/22) | Calls widget: tighten Pending to schedule booked only | — | Pending = confirmed appointment only |
| [#21](https://github.com/llgsoldiersonly/llg-platform/pull/21) | Calls widget: expand status mapping | — | Real tag set, not just original 5 |
| [#20](https://github.com/llgsoldiersonly/llg-platform/pull/20) | CallRail: extract tag.name in API client | — | Bug fix: tags were stored as JSON-stringified objects |
| [#19](https://github.com/llgsoldiersonly/llg-platform/pull/19) | Client overview: Calls widget with tabs | `0026` | New widget on `/overview` post-launch |
| [#18](https://github.com/llgsoldiersonly/llg-platform/pull/18) | Per-client Site Health toggle | `0025` | `clients.show_site_health` bool |
| [#17](https://github.com/llgsoldiersonly/llg-platform/pull/17) | Auto-flip deliverables to done on any submission | — | Bug fix + simpler rule per Nathan |
| [#16](https://github.com/llgsoldiersonly/llg-platform/pull/16) | Site Health: blend real-user CrUX with lab | `0024` | 66/34 weighted Performance score |
| [#15](https://github.com/llgsoldiersonly/llg-platform/pull/15) | Deliverables: Pre-launch + Recurring tabs | — | Split admin view by frequency |
| [#14](https://github.com/llgsoldiersonly/llg-platform/pull/14) | Dashboard Tutorial tab on context widget | — | Tabbed widget on client overview |
| [#13](https://github.com/llgsoldiersonly/llg-platform/pull/13) | Bulk paste mode + Mark complete | — | New submission UX |

### Production data state

- **6 active firms**, all syncing CallRail daily (1,289 historical calls backfilled with tags + AI summaries)
- **9 client_users** on Reiersen Law (including the 7 added 2026-05-22), 1 on each other firm
- **9 agency_staff** (Igor, Misha, Daylin, Jake, Hans, Andy, plus Emma Pratt added 2026-05-18)
- **5 super_admins** (Nathan, Nick, Brittany, Marissa, Jon)
- **Site health**: 3 of 6 firms have CrUX data (Dooley, Gilliam, Reiersen); others fall back to lab-only
- **Lighthouse cron** runs Mondays 03:30 UTC; CallRail cron runs daily 02:20 UTC

### Things changed but not yet observed in production

These shipped in the last 24 hours and haven't had a full production cycle yet — worth eyeballing:

1. **PR #27 (Video kind)** — Video should appear in the Kind dropdown. No staff has submitted a video against `VIDEO_EN` yet through the new path.
2. **PR #26 (Kind filtering)** — Real verification waits on the next batch of staff submissions.
3. **PR #17 (auto-done on any submission)** — Watch over the next week for any "this deliverable shouldn't be done yet" complaints. The rule is now permissive: any linked submission flips status to done unless the row was explicitly `skipped`/`blocked`.

---

## 5. Known Issues & Technical Debt

### 🔴 Active issues

#### `posts` table empty for all 6 firms
The `posts` table feeds the "Recent Updates" card alongside submissions and calls. All 6 firms show 0 posts. Either:
- The WordPress cron (`/api/cron/wordpress`, daily 02:00 UTC) isn't producing
- The Pabbly webhook (`/api/webhooks/pabbly/wordpress`) isn't being hit
- Or these firms simply don't have WordPress connected

Not blocking — submissions and calls still surface in Recent Updates — but worth a 30-min investigation. Check `sync_log` for `cron:wordpress` entries and `client_credentials.wp_*` fields per firm.

#### `pnpm lint` is broken
ESM resolution issue in `eslint-config-next`:
```
Cannot find module '/.../eslint-config-next/core-web-vitals'
Did you mean to import "eslint-config-next/core-web-vitals.js"?
```
Pre-existing — unrelated to any recent PR. Workaround: rely on `pnpm typecheck` (which passes). Real fix: pin `eslint-config-next` to a working version or update `eslint.config.mjs` to use the explicit `.js` extension.

#### GoDaddy AES quarantines first-touch magic links
Recipient domains with GoDaddy Advanced Email Security (Lucrative Legal's email domain, possibly others) quarantine the first email from `spaceman@llgportal.com`. **Per-mailbox**, not tenant-wide — Brittany hit this 2026-05-15, three other staff (Igor, Daylin, Jake) received cleanly. Workarounds:
- User clicks "Trust sender" in the GoDaddy quarantine release email → all future links flow through
- Or use `grant-staff-user.ts` to mint a direct magic link, DM/text it

Real fix requires lucrativelegal.com's AES admin to allowlist `llgportal.com` tenant-wide. Out of LLG's control unless someone there grants access.

#### DKIM record at Ionos has a duplicated `p=` prefix
TXT record at `resend._domainkey.llgportal.com`:
```
p=p=MIGfMA0GCSqGSIb3DQEBAQUAA4G...
```
Should be `p=MIGf...` (single `p=`). Doesn't block delivery today — 3 of 4 @lucrativelegal staff received the magic link fine — but lowers sender reputation. **5-minute fix at Ionos**: remove one `p=` from the value.

### 🟡 Open PRs (pre-existing, not from this sprint)

- **[PR #11](https://github.com/llgsoldiersonly/llg-platform/pull/11)** — DataForSEO portal integration (open since 2026-05-07)
- **[PR #12](https://github.com/llgsoldiersonly/llg-platform/pull/12)** — GBP: switch `getGmbInfo` from `business_listings` to Local Finder (draft, since 2026-05-09)

Worth a triage pass — neither has been touched in 2 weeks.

### 🟢 Latent debt worth knowing about

#### Redundant auto-approve trigger
[Migration 0018's `auto_approve_social_submission`](supabase/migrations/0018_deliverable_submissions.sql#L69-L87) is dead code since [0021 generalized it](supabase/migrations/0021_auto_approve_all_submissions.sql). Cleanup migration ≈ 5 lines.

#### Service-level deliverables have no submission Kind
Codes like `GOOGLE_ADS_MGMT`, `LIVE_INTAKES`, `AFTER_HOURS`, `CASE_LEAD_GEN`, etc. (~20 total) don't match any submission Kind because they're ongoing services with no individual URL to submit. Staff mark them done via Admin Deliverables → Mark Complete button. This is **by design** — not a bug — but worth knowing if anyone asks "why isn't there a 'Live Intakes' kind."

#### CrUX coverage is per-(URL, strategy)
A firm may have CrUX data for mobile but not desktop, or vice versa, depending on Chrome user distribution. The Site Health card prefers mobile, falls back to desktop, falls back to lab-only. Reasonable behavior, but worth flagging if a client asks "why is my score different on different days."

#### `fid_ms` column is actually TTI
[psi.ts](lib/integrations/psi.ts) maps the `interactive` audit (Time to Interactive) to a field named `fid_ms`. FID is deprecated; INP is the modern equivalent and lives separately in CrUX columns. Don't be surprised by the misleading column name — see the in-line comment.

#### No webhook ingestion for CallRail (yet)
Calls only land via the daily cron, so a call at 23:55 UTC won't appear until ~02:20 UTC the next day. Webhook receiver at `/api/webhooks/callrail/calls` would close this. ~50 lines, mirrors the cron's normalization.

#### Tickets/Calls/Posts merge into Recent Updates as separate streams
The "Recent Updates" card on `/overview` ([app/(client)/overview/page.tsx:247](<app/(client)/overview/page.tsx>) — search for `const updates`) merges 3 sources and sorts by `occurred_at`. No deduplication across sources — usually fine since each source has distinct entities, but watch for double-counting if a submission gets re-emitted as a wp_post.

---

## 6. Next Steps

### Immediate (next 1–2 weeks)

Ordered by impact, not by ease.

1. **Investigate `posts` table being empty.** Either start it producing or document why it can't and adjust the Recent Updates card's expectations.
2. **Triage the two open PRs (#11, #12).** They've sat for 2+ weeks. Either land or close — open PRs rot.
3. **Verify the auto-done behavior doesn't surprise anyone.** PR #17 changed completion semantics significantly. Check in with super_admins after a week: any complaints about deliverables flipping too aggressively?
4. **Confirm the kind-filtering UX with staff.** PR #26 / #27 are operationally meaningful — bad assumptions in `KIND_TO_CODE_PREDICATE` would silently filter out legitimate options. Watch for "I can't pick the deliverable I want" feedback.
5. **Fix the DKIM `p=p=` typo at Ionos.** 5 minutes, lowers risk of future delivery issues on any new recipient domain.

### Roadmap items raised but not yet scoped

- **CallRail real-time webhook** — closes the 24h delay on call ingestion
- **CrUX coverage report widget** — surface coverage on `/admin/system/health` so the team knows which firms qualify
- **Per-client target_count overrides** — let smaller-market clients get scaled-down packages without skipping rows entirely
- **URL templates for high-volume pre-launch kinds** — paste 100 city names → system fills the URL template for Parent/Child Pages
- **AI-overview impact tracking** — Google's AI Overview citations affect organic traffic; no current measurement

### Areas where the platform deliberately *doesn't* do something

If a team member assumes these are missing and starts building them, surface the prior decision first:

- **No client-side write paths.** Everything mutating goes through a server action with explicit RBAC. No exceptions.
- **No frontend Supabase subscriptions (realtime).** The dashboard is render-on-load; auto-revalidation is `revalidatePath` after mutations.
- **No payment processing.** Billing happens outside (Stripe direct?). The `next_billing_at` field on `clients` is informational only.
- **No file uploads from client_users.** Tickets allow text + URLs. No attachment infrastructure.
- **No bulk import of clients/deliverables.** All client onboarding is hand-driven through `/admin/clients/new` + the package selector.

---

## 7. Access & Permissions

### Required accounts

| Service | Who has admin | What's needed for dev |
|---|---|---|
| GitHub | `llgsoldiersonly` (org owner: Nathan) | Push access to the repo |
| Vercel | `llg-team` org (Nathan owner) | Member of `llg-team` to run `vercel env pull` |
| Supabase | Project `ifonutjkbciqtpckynhb` | Member of the project for SQL editor / MCP access |
| Ionos | Nathan only | DNS edits for `llgportal.com` |
| Resend | Nathan (lucrativelegal account) | Resend dashboard for delivery debugging |
| CallRail | `ACC6e32cecb30544e85a31a9c2d104f89bc` (shared) | LLG's CallRail master account |
| DataForSEO | `jondkennedy.com@gmail.com` | Tied to Jon's account; he owns this |
| PageSpeed Insights | Google Cloud project key | In Vercel env as `PSI_API_KEY` |
| Vercel Blob | Same Vercel project | `BLOB_READ_WRITE_TOKEN` in env |
| Anthropic API | (optional) | Not currently used in app code; was for ad-hoc analysis |

### Environment variables (all in Vercel production)

Pulled via `vercel env pull /tmp/prod.env --environment=production --yes`:

```
NEXT_PUBLIC_SUPABASE_URL        — public
NEXT_PUBLIC_SUPABASE_ANON_KEY   — public
SUPABASE_SERVICE_ROLE_KEY       — SECRET, server-only, RLS bypass
CRON_SECRET                     — SECRET, gates all /api/cron/* routes
CALLRAIL_API_TOKEN              — SECRET, single token for all firms
CALLRAIL_DEFAULT_ACCOUNT_ID     — non-secret, the shared account ID
PSI_API_KEY                     — SECRET, Google PSI API key
DATAFORSEO_LOGIN                — non-secret, jondkennedy.com@gmail.com
DATAFORSEO_PASSWORD             — SECRET
BLOB_READ_WRITE_TOKEN           — SECRET, Vercel Blob for tutorial videos
RC_WEBHOOK_ALERTS               — non-secret, RingCentral Glip channel webhook
RC_WEBHOOK_<TEAM>               — per-department Glip webhooks for ticket routing
```

### Auth identities worth knowing

| Email | Role | Notes |
|---|---|---|
| nathan.u@lucrativelegal.com | super_admin | Primary; owns most external accounts |
| nick.@lucrativelegal.com | super_admin | Backup admin |
| brittany.w@lucrativelegal.com | super_admin | Backup; hit the GoDaddy AES issue first |
| marissa.@lucrativelegal.com | super_admin | Backup |
| jondkennedy.com@gmail.com | super_admin | Owns DataForSEO account too |
| emma.p@lucrativelegal.com | agency_staff | Added 2026-05-18 |
| igor.k, misha.l, daylin.r, jake.b, hans.f, andres.p @lucrativelegal.com | agency_staff | 6 staff, all provisioned 2026-05-15 |

### Repository conventions

- **Branch naming:** `feature/<kebab-description>` or `fix/<kebab-description>`
- **PR workflow:** branch → push → `gh pr create --base main` → `gh pr merge --squash --delete-branch`. Direct push to `main` is blocked by a PR-review gate.
- **Commit messages:** descriptive, area-prefixed (`Submissions:`, `Calls widget:`, etc.), with rationale in the body. See `git log --oneline -20` for the house style.
- **Migrations:** numbered sequentially in `supabase/migrations/`. Always `create or replace` for views, `if not exists` for tables/columns — they get applied via the Supabase MCP `apply_migration` tool, not `supabase db push` (the project doesn't have the Supabase CLI wired in).

### Production access patterns

- **Database (read/write via SQL):** Supabase dashboard SQL editor (project `ifonutjkbciqtpckynhb`)
- **Server-side scripts** (provisioning, backfills): `pnpm tsx --env-file=.env.local scripts/<name>.ts` with `.env.local` populated from `vercel env pull --environment=production`
- **Cron manual fire:** `curl -X POST https://llgportal.com/api/cron/<name> -H "x-cron-secret: $CRON_SECRET"`
- **Deployment:** push to `main` triggers auto-deploy; `vercel ls --scope llg-team` to inspect status

---

## Appendix A — Skills the next engineer should be comfortable with

- Next.js App Router (Server Components, server actions, parallel data fetching with `Promise.all`)
- Supabase admin client + RLS policies
- Reading and writing PostgREST queries via `@supabase/supabase-js`
- Understanding Postgres views, GIN indexes, and the `CREATE OR REPLACE VIEW` ordering constraint
- Reading CallRail's v3 API docs (tags, lead_explanation, lead_score)
- Reading Google PSI v5 API responses (lighthouseResult + loadingExperience)
- TypeScript discriminated unions (`Result<T>`, `CallStatus`, etc.)
- Tailwind + Radix UI patterns
- `gh` CLI + `vercel` CLI

## Appendix B — How to verify the platform is healthy after a deploy

1. Fire each cron once and confirm `{ok: true}`:
   ```bash
   for path in lighthouse callrail metricool reviews; do
     curl -sS -X POST "https://llgportal.com/api/cron/$path" \
       -H "x-cron-secret: $CRON_SECRET" --max-time 180
     echo
   done
   ```
2. Open `/admin/system/health` as a super_admin — recent `sync_log` rows should show `status='ok'`.
3. View as a client (any post-launch firm — Reiersen has the richest data):
   - `/overview` renders without crashing
   - Calls widget tabs populate
   - Monthly Production card shows non-zero counts somewhere
   - Site Health card renders (or is hidden for Reiersen specifically — that's intentional)
4. `/staff` form: switch Kind, confirm Counts toward dropdown narrows.
5. `pnpm typecheck` in the local repo.

## Appendix C — Files modified across the May 14–22 sprint (alphabetical)

Useful as a "what's been touched recently" map for code review of new joiners:

```
app/(client)/overview/page.tsx                          — heaviest churn; almost every PR touched it
app/admin/clients/[id]/deliverables/page.tsx
app/admin/clients/[id]/deliverables/deliverables-tabs.tsx
app/admin/clients/[id]/deliverables/row-actions.tsx
app/admin/submissions/new/page.tsx
app/admin/submissions/new/submission-form.tsx
app/api/cron/callrail/route.ts
app/api/cron/lighthouse/route.ts
app/staff/page.tsx
app/staff/staff-submit-form.tsx
components/client/cards/calls.tsx                       — new file (PR #19)
components/client/cards/lighthouse-scores.tsx
components/client/cards/why-this-matters.tsx
lib/actions/submissions.ts
lib/calls/status.ts                                     — new file (PR #19)
lib/integrations/callrail.ts
lib/integrations/psi.ts
lib/integrations/score-blend.ts                         — new file (PR #16)
lib/submissions/kinds.ts
lib/client-context.ts
supabase/migrations/0024_site_health_crux_blend.sql     — new
supabase/migrations/0025_clients_show_site_health.sql   — new
supabase/migrations/0026_calls_tags.sql                 — new
supabase/migrations/0027_calls_ai_summary.sql           — new
supabase/migrations/0028_deliverables_display_code.sql  — new
```
