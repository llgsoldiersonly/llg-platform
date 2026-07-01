# LLG Platform — Engineering Handoff

**As of:** 2026-07-01
**Author:** Rolling handoff — originally written after the May 14–22 sprint, now extended through the May 22 → July 1 work.
**Repo:** [github.com/llgsoldiersonly/llg-platform](https://github.com/llgsoldiersonly/llg-platform)
**Production URL:** [llgportal.com](https://llgportal.com)
**Hosted on:** Vercel (`llg-team/llg-platform`)

> **Reading order:** This document is in two parts.
> **Part I** (§1–§7 + Appendices) is the original May 22 handoff — the architecture, patterns, and access notes are all still current, so read it first for the foundations.
> **Part II** (near the bottom, "PART II — May 22 → July 1, 2026") is the detailed log of everything shipped since: multi-site support, the pivot into employee project management (tasks, kanban, My Day, notifications), lead delivery, and a batch of operational fixes. Where Part I and Part II disagree on a specific behavior, **Part II wins**.
>
> ⚠️ **Before trusting the DB section:** several migrations (0031, 0033–0037) are applied to production by hand, not by the pipeline. Check "Database migrations 0029–0037" in Part II for exactly which are live vs. still owed.

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

# PART II — May 22 → July 1, 2026

Everything below was built after the original handoff above. It's the current
state of the platform as of **2026-07-01**.

## II.0 The big shift: from client portal to client portal **+ employee ops**

The May sprint (Part I) was all about the **client-facing** product. Since then
the platform has grown a second identity: an **internal project-management
system for LLG's own staff**. The same Next.js app + Supabase DB now serves two
distinct jobs:

1. **Client portal** (unchanged in spirit) — firms log in and see their SEO /
   GBP / ads / calls data. This got a big feature (multi-site) plus a lead-
   delivery box and price removal.
2. **Employee operations** (new) — super-admins assign and track *tasks* and
   *deliverables* across staff, on kanban boards, with due dates, hours, comments,
   proof-of-work, an internal per-client asset folder, and in-app notifications.

The three audiences were already gate-separated in Part I (`/admin/*` = super_admin,
`/staff/*` = agency_staff, client portal = client_user). Part II leans hard on
that separation — see **II.6 Portal separation rules**, which is now a load-
bearing invariant, not just a nicety.

---

## II.1 Shipped since the handoff (PRs #29 – #50)

All squash-merged to `main` unless noted. Reverse chronological. "Mig" = the
migration the PR depends on (see **II.5** for apply-status).

| PR | Title | Mig | One-line behavior |
|---|---|---|---|
| [#50](https://github.com/llgsoldiersonly/llg-platform/pull/50) | Employee UX 3/N: inline deliverable proof + due-date reminders | — | **DRAFT / in review.** Paperclip-on-card proof URL + daily task-reminder cron |
| [#49](https://github.com/llgsoldiersonly/llg-platform/pull/49) | Employee UX 2/N: task detail — comments, activity, hours | 0037 | Task detail page: comment thread, activity log, estimated/actual hours |
| [#48](https://github.com/llgsoldiersonly/llg-platform/pull/48) | Employee UX 1/N: "My Day" home + notifications bell | — | `/staff` becomes a My Day dashboard; notification bell in both portals |
| [#47](https://github.com/llgsoldiersonly/llg-platform/pull/47) | Kanban: purple edges, submit gate, Paused + reason | 0036 | Submit gate (staff→In review, admin→Submitted); Blocked→Paused w/ reason |
| [#46](https://github.com/llgsoldiersonly/llg-platform/pull/46) | DataForSEO: drop invalid `date_from` on bulk_new_lost_backlinks | — | Bug fix: endpoint rejected `date_from` ("Invalid Field") |
| [#45](https://github.com/llgsoldiersonly/llg-platform/pull/45) | Kanban boards: global (super-admin) + personal "My Work" (staff) | — | Two boards; columns To do / In progress / In review / Paused / Submitted |
| [#44](https://github.com/llgsoldiersonly/llg-platform/pull/44) | Deliverables (PM phase 3): deliverable-level ownership | 0035 | `deliverables.assigned_to`; view exposes it; personal board shows deliverables |
| [#43](https://github.com/llgsoldiersonly/llg-platform/pull/43) | Assets: per-client internal asset folder (staff upload, attach-to-task) | 0034 | `client_assets` table + private `client-assets` bucket; internal-only |
| [#42](https://github.com/llgsoldiersonly/llg-platform/pull/42) | Tasks (PM phase 1): timeline, per-client tab, completed handling + search | 0033 | `tasks.start_date`; completed tasks greyed + searchable; admin-only reopen |
| [#41](https://github.com/llgsoldiersonly/llg-platform/pull/41) | Clients: "Set site live" toggle (pre-launch ↔ live) | — | Flip a client between onboarding/prospect and live from admin |
| [#40](https://github.com/llgsoldiersonly/llg-platform/pull/40) | Clients: edit client record (contact email, domain, status, etc.) | — | Edit-client form; fixes "wrong email keeps showing" cases |
| [#39](https://github.com/llgsoldiersonly/llg-platform/pull/39) | Leads: per-client PDF lead delivery (admin upload → client download) | 0032 | `client_leads` + `lead-files` bucket; gated by `clients.leads_enabled` |
| [#38](https://github.com/llgsoldiersonly/llg-platform/pull/38) | Local SEO: "Pull BrightLocal citations" button | — | On-demand citation pull (see BrightLocal caveat in II.7) |
| [#37](https://github.com/llgsoldiersonly/llg-platform/pull/37) | Branding: set favicon to the Lucrative Legal icon | — | Cosmetic |
| [#36](https://github.com/llgsoldiersonly/llg-platform/pull/36) | Staff: editable department/title/role + add Social department | 0031 | Edit staff profile fields; new "Social" department |
| [#35](https://github.com/llgsoldiersonly/llg-platform/pull/35) | Admin: "Pull latest data" button for on-demand integration refresh | — | Manual per-client refresh instead of waiting for cron |
| [#34](https://github.com/llgsoldiersonly/llg-platform/pull/34) | Deliverables: "Generate deliverables now" button + auto-run on client create | — | Fixes "deliverables don't populate for new clients" |
| [#33](https://github.com/llgsoldiersonly/llg-platform/pull/33) | Multi-site (3/3): client portal site switcher | — | Per-site switcher in the client portal |
| [#32](https://github.com/llgsoldiersonly/llg-platform/pull/32) | Multi-site (2/3): per-site data scoping + cron fan-out | 0030 | `site_id` on domain-driven tables; crons fan out per active site |
| [#31](https://github.com/llgsoldiersonly/llg-platform/pull/31) | Multi-site (1/3): client_sites foundation + management UI | 0029 | `client_sites` table + admin management UI; mirrors `primary_domain` |
| [#30](https://github.com/llgsoldiersonly/llg-platform/pull/30) | Client view: remove package price from Overview and SEO Plan | — | Price hidden from the client-facing portal |
| [#29](https://github.com/llgsoldiersonly/llg-platform/pull/29) | Clients: add "New client" admin flow | — | `/admin/clients/new`; package required at create time |

> Note: the Vercel preview deploy for **#50** is green (build passed). It is
> still a **draft** awaiting the user's "merge". The normal merge ritual is in
> II.9.

---

## II.2 Multi-site support (PRs #31–#33) — deep dive

**The problem.** Some firms run two websites — the canonical example is
**azizilawfirm.com** (organic + ads) plus **callazizi.com** (GBP/local). Until
now a client had exactly one tracked domain (`clients.primary_domain`) that
drove organic rankings, backlinks, site-health, WordPress sync, etc. That model
couldn't represent a second site.

**The model (migration 0029 → `client_sites`).**
- New table `client_sites(id, client_id, domain, label, purpose, is_primary, is_active, …)`.
- Constraints: **at most one primary site per client** (partial unique index on `is_primary`), and **no duplicate domains within a client** (case-insensitive unique on `(client_id, lower(domain))`).
- **Backfill + mirror trigger:** every existing client got one primary site seeded from `primary_domain`, and a trigger keeps `clients.primary_domain` mirrored to the active primary site. This is what makes the rollout safe — **every pre-existing reader and cron kept working unchanged** because `primary_domain` still resolves.

**Per-site data scoping (migration 0030).**
- Added a nullable `site_id` FK to the tables whose data belongs to a specific website: `dfs_tracked_keywords`, `dfs_keyword_rank_snapshots`, `dfs_backlink_snapshots`, `dfs_backlink_rows`, `site_health`, `raw_lighthouse`, `posts`, `raw_wordpress`.
- FK is `on delete set null` on purpose — **deleting a site row must never delete historical metrics**, just detach them.
- Every existing row was backfilled to the client's primary site.
- Crons **fan out**: for each active site they write the correct `site_id`, so a secondary domain accumulates its own organic/backlinks/site-health/blog history.

**What stayed per-client / per-location (deliberately NOT site-scoped):**
- **AI visibility** and **competitor discovery** — primary-site only.
- **GMB / local / map-grid** — these are `place_id` / location-driven, not domain-driven, so they stay per-location.
- **Ads & intakes** — per-client (account IDs), not per-site.
- **Blogs / submissions** — stayed as they were; staff-submitted blogs were **not** changed. (This was an explicit back-and-forth with the user: "keep submissions how they are now… rankings stay on callazizi.")

**Client portal switcher (#33).** The client portal gained a site switcher so a
firm with two sites can toggle which site's data they're viewing.

**Lead-buyer clients.** Multi-site work also formalized clients that have **no
package/subscription** (they just buy leads). Those clients skip the
package-required path and are served by the Leads feature (II.4).

**Verification.** After 0030 was applied to prod, correctness was checked with
an all-zeros null-check query (confirming no domain-driven row was left with a
null `site_id`).

---

## II.3 Employee project-management layer — deep dive

This is the biggest net-new surface since the handoff. The user explicitly
confirmed a 7-item UX plan ("**Let's do all your recommendations**") and asked
for it **one PR at a time**. Status of the 7:

| # | Item | Status | Where |
|---|---|---|---|
| 1 | **My Day** home for staff | ✅ shipped | #48 |
| 2 | **Notifications bell** (in-app) | ✅ shipped | #48 |
| 3 | **Task detail + comments** | ✅ shipped | #49 |
| 4 | **Hours logging** (estimated/actual) | ✅ shipped | #49 |
| 5 | **Inline deliverable proof** | 🟡 in review | #50 (draft) |
| 6 | **Due-date nudges** | 🟡 in review | #50 (draft) |
| 7 | **Onboarding launch board** | ⬜ not started | — |

### Tasks (PR #42)
- `tasks` gained `start_date` (0033) so an assignment has a **timeline** (start → due), not just a due date.
- Admin task **list view** (`/admin/tasks`) with search that **includes completed tasks**. Completed/cancelled rows render **greyed + struck-through**; only a **super-admin can reopen** them (`RotateCcw` control). Staff cannot silently walk back a finished task.
- Tasks can be **client-scoped or internal** (null `client_id` → shown as "internal").
- Server actions live in `lib/actions/tasks.ts`: `createTask`, `updateTaskStatus(id, status, reason?)`, `reassignTask`, `deleteTask`, `addTaskComment`, `setTaskHours`.

### Kanban boards (PR #45, refined in #47)
Two boards, one shared component `components/admin/kanban-board.tsx`:
- **Global board** (`/admin/tasks/board`, super-admin) — everyone's tasks, with an **assignee filter** to focus one person.
- **Personal "My Work" board** (`/staff/board`, each staffer) — that person's **tasks *and* deliverables**, drag-to-update.
- **Columns:** To do → In progress → In review → **Paused** → **Submitted**.
- **Priority is a red-tint card flag**, not a column (user's call: "priority should be marked by super admin so a card flag is good… red tint"). Urgent/high cards get a left danger border + a destructive badge.
- **Column edges are purple** (`border-2 border-border-brand/40`, brighter on drag-over) for visual separation — a specific user request.
- Deliverable cards map board columns onto the deliverable enum (`boardToDeliverableStatus`), since deliverables have no native "in_review".

### The submit gate + Paused/reason (PR #47, migration 0036)
- **Submit gate:** moving a **task** to **Submitted** (`done`) is **super-admin only**. Staff take work as far as **In review**; a super-admin does the final submit. Enforced in `updateTaskStatus` (`FORBIDDEN` if a non-admin targets `done`) *and* in the board UI.
- **Blocked → "Paused":** the board relabels the `blocked` status as **Paused**, and moving a card there **prompts for a reason** (`window.prompt('Why is this paused?…')`). The reason is stored in `tasks.block_reason` (0036) and cleared automatically when the task leaves Paused. Shown on the card and on My Day.

### Deliverable-level ownership (PR #44, migration 0035)
- The chosen operating model (user's words): **"deliverable-level ownership + tasks for everything else."**
- `deliverables.assigned_to` added; `deliverables_display` view recreated to expose it (append-only column, so existing column order is preserved).
- `assigned_to` (who's responsible) is distinct from `completed_by` (who marked it done).
- The personal board and My Day both pull the staffer's assigned deliverables (`assigned_to = user.id`).

### Per-client internal asset folder (PR #43, migration 0034)
- `client_assets` table + private **`client-assets`** storage bucket (50 MB cap).
- **Internal only** — there is deliberately **no client_user RLS policy**; clients can't see these. Staff-only (`is_agency_staff()`).
- An asset can optionally be **attached to a task** (`task_id`, `on delete set null`).
- Solves the user's "upload assets assigned to one customer folder so things don't get messy."

### My Day + notifications bell (PR #48)
- `/staff` is now a **My Day** dashboard: the staffer's open tasks + deliverables bucketed into **Overdue / Due today / Waiting on you (Paused) / In review**, plus the submit-completed-work form below. (See `app/staff/page.tsx`.)
- **Notifications bell** added to both the staff header and the admin topbar (`components/notifications-bell.tsx` + `notifications-menu.tsx`), with unread count, mark-read, and mark-all-read (`lib/actions/notifications.ts`). The `notifications` table existed since Part I but was never surfaced until now.
- Notification deep-links are **role-aware** via the `taskLink()` helper (staff → `/staff/tasks/:id`, admin → `/admin/tasks/:id`).

### Task detail + comments + hours (PR #49, migration 0037)
- Task detail pages at `/admin/tasks/[id]` and `/staff/tasks/[id]` (two routes, one component `components/admin/task-detail.tsx`, data loader `lib/task-detail-data.ts`).
- **Comment thread** backed by `task_comments` (0037, staff-only RLS) via `addTaskComment`.
- **Activity log** (resolved actor names) from the existing `activity_log`.
- **Hours editor:** estimated + actual hours (`setTaskHours`).

### Inline deliverable proof + due-date reminders (PR #50 — in review)
- **#5 Inline proof:** deliverable cards on both boards get a **paperclip button** → prompts for a URL → new server action `submitDeliverableProof(deliverableId, url)` (`lib/actions/submissions.ts`). It looks the deliverable up server-side, **infers the submission kind from its template code** via a new `deriveKindFromCode()` helper in `lib/submissions/kinds.ts` (reverse of the existing `KIND_TO_CODE_PREDICATE`, default `link`), inserts one auto-approved `deliverable_submissions` row, and bumps the counter (flipping the deliverable to done). Only the URL is trusted from the browser — `client_id`/`kind` are derived server-side.
- **#6 Due-date reminders:** new cron `app/api/cron/task-reminders/route.ts` (daily **13:00 UTC**, registered in `vercel.json`). Finds open tasks (`assigned_to` set, `due_date <= today`, status not done/cancelled) and writes a `notifications` row (`type='task_reminder'`) per assignee — surfacing in the bell. **Deduped per task per day** (skips tasks that already got a reminder today) so re-runs don't double-notify. Logs to `sync_log`. **No migration required.**

---

## II.4 Lead delivery + client-record editing + go-live (PRs #39, #40, #41)

- **Leads (#39, migration 0032):** per-client PDF lead delivery. Admin uploads PDFs → client downloads them from the portal. Gated by `clients.leads_enabled`. `client_lead_files` metadata table + private **`lead-files`** bucket (PDF-only, 25 MB cap). Client read is RLS-scoped (`accessible_client_ids()`); files are served via short-lived signed URLs. Designed to also serve **lead-buyer clients with no package**.
- **Edit client (#40):** an edit-client form for contact email, domain, status, etc. This fixed the recurring "I sent the magic link to X but the original email keeps showing up" problem — the client's email is now editable in one place.
- **Set site live (#41):** a toggle to flip a client between pre-launch (`onboarding`/`prospect`) and `live`. Ties into the middleware `preLaunch` gate (a pre-launch client sees the onboarding experience; live flips them to the full portal).

---

## II.5 Deliverable generation + on-demand refresh (PRs #34, #35)

- **Generate deliverables now (#34):** deliverables are generated from the client's package. This PR added a **"Generate deliverables now"** button *and* made generation **auto-run on client create** — fixing the user's "when do deliverables populate for new clients?" (previously they didn't until a cron ran).
- **Pull latest data (#35):** an admin **"Pull latest data"** button to refresh a client's integrations on demand instead of waiting for the daily cron — used when onboarding a client or debugging an integration.

---

## II.6 Portal separation rules (now load-bearing)

The three experiences are strictly separated and this is now an **invariant** the
PM features depend on:

- `/admin/*` → **super_admin only**.
- `/staff/*` → **agency_staff only**. **A super_admin cannot access `/staff`** (they have their own admin surfaces). Middleware treats `preLaunch = status in ('onboarding','prospect')` for clients.
- Client portal → **client_user**, RLS-scoped to their firm.
- Anything that both staff and admin can reach (task detail, notifications) is solved with **two routes sharing one component** + the **role-aware `taskLink()`** helper. When adding a staff-facing feature, always ask "does the super-admin equivalent live under `/admin`?" — don't assume one route serves both.

---

## II.7 Database migrations 0029–0037 (apply-status matters!)

Migrations are **applied to production by hand** (Supabase SQL editor / MCP),
**not** by the deploy pipeline. All are idempotent (`if not exists`, `on
conflict`, `create or replace`). Status as of 2026-07-01:

| Mig | File | Adds | Prod status |
|---|---|---|---|
| 0029 | `client_sites.sql` | `client_sites` table + backfill + mirror trigger | ✅ applied |
| 0030 | `client_sites_data_scoping.sql` | `site_id` on 8 domain-driven tables + backfill | ✅ applied |
| 0031 | `social_department.sql` | `('Social','social')` department row | ⚠️ **in the combined block owed to prod** |
| 0032 | `client_leads.sql` | `clients.leads_enabled`, `client_lead_files`, `lead-files` bucket | ✅ applied |
| 0033 | `task_start_date.sql` | `tasks.start_date` | ⚠️ **owed** |
| 0034 | `client_assets.sql` | `client_assets` + `client-assets` bucket | ⚠️ **owed** |
| 0035 | `deliverable_assignee.sql` | `deliverables.assigned_to` + recreate `deliverables_display` | ⚠️ **owed** |
| 0036 | `task_block_reason.sql` | `tasks.block_reason` | ⚠️ **owed** |
| 0037 | `task_comments.sql` | `task_comments` table + staff RLS | ⚠️ **owed** |

> **Action for whoever owns prod:** a **combined SQL block** for **0031, 0033,
> 0034, 0035, 0036, 0037** was handed to the user to paste into the Supabase SQL
> editor. Until it runs, the PM features (tasks timeline, assets, deliverable
> ownership, Paused reason, comments) will throw "column/table not found" errors
> in production even though the code is deployed. This is the single most common
> "it looks broken" cause in this codebase — **always check migration
> apply-status first.**

---

## II.8 New cron jobs

Added to `vercel.json` since the handoff:

| Path | Schedule (UTC) | Purpose |
|---|---|---|
| `/api/cron/task-reminders` | `0 13 * * *` (daily) | Due/overdue task nudges → notifications (PR #50) |

Multi-site (#32) did **not** add new cron *paths* — it made the existing
domain-driven crons **fan out per active site** instead. All crons remain
`isAuthorizedCron`-gated (`x-cron-secret` header or `Authorization: Bearer
$CRON_SECRET`) with `export const GET = POST`.

---

## II.9 Operational incidents & fixes (chronological)

These were diagnosed live with the user; capturing them so they're not
re-debugged from scratch:

1. **Invite email fails (550).** Resend refused because the sending domain
   (`llgportal.com`) was **unverified**. User verified it in Resend. A half-
   created user (`david@azizilawfirm.com`) needed cleanup afterward.
2. **Magic-link 404.** Supabase Auth **Site URL** was `http://llgportal.com`
   (should be **`https://`**). User fixed it; the redirect allow-list already had
   `https://llgportal.com/**`. **If magic links 404 again, check Site URL scheme
   first.**
3. **DataForSEO "Access denied".** Not a bug — the account isn't **subscribed to
   the backlinks API**. Later a second error, **"Invalid Field: 'date_from'"**,
   *was* a bug: the `/backlinks/bulk_new_lost_backlinks/live` endpoint doesn't
   accept `date_from`. Fixed in **#46** (`lib/integrations/dataforseo/backlinks.ts`).
4. **BrightLocal citations don't work even with the right API key.** The legacy
   BrightLocal API needs **`api-key` + `sig` + `expires`** (HMAC-signed
   requests); the client only sends `api-key`. The "Pull BrightLocal citations"
   button (#38) is wired but **won't succeed until HMAC signing + a paid plan are
   in place** (owed on the user's side — see II.10). DataForSEO does **not**
   cover the same citation data.
5. **Duplicate "Tasks" tab / greyed-deliverable confusion / "blogs need
   approval"** — small self-corrections made during the build. For the record:
   migration **0021 auto-approves ALL submissions**; there is no pending/approval
   state for blogs.
6. **`normalizeDomain` build failure.** A sync helper was exported from a `'use
   server'` file (server actions must be async). Fixed by importing the existing
   `normalizeDomain` from `lib/integrations/dataforseo/normalize.ts` instead.

---

## II.10 Configuration still owed on the user's side (not code)

These are **account/config tasks**, not code — the platform is ready for them:

- **Apply the combined migration block** (0031, 0033–0037) to prod. *(highest priority — see II.7)*
- **BrightLocal:** add the API **secret** + a paid plan; the code path needs HMAC signing before citations pull.
- **Azizi GBP:** set lat/lng + `place_id` for the location.
- **Azizi CallRail:** set the `company_id` (the `COM…` value).
- **DataForSEO:** enable the **Business Data** module for GBP, and the **backlinks** subscription if backlink data is wanted.
- **Merge PR #50** (currently draft, build green) when ready.

---

## II.11 Updated known issues / still-stubbed

Supersedes the relevant bits of §5 where they overlap:

- **Migrations owed to prod (II.7)** — the #1 "looks broken but isn't" cause now.
- **BrightLocal citations** — button exists, backend blocked on HMAC + plan (II.9 #4).
- **Tickets tab** is still a **stub**.
- **Reviews-by-directory** is not wired to a button (user chose to skip).
- Everything from §5 that wasn't touched (empty `posts` table, `pnpm lint`
  broken, GoDaddy AES first-touch quarantine, DKIM `p=p=` typo at Ionos) is
  **still open** — none were addressed in Part II.

---

## II.12 Immediate next step

**#7 — Onboarding launch board** (the last of the 7 UX items). Intended as a
board that tracks a client's pre-launch checklist through to go-live, tying
together the pre-launch deliverables, the "Set site live" toggle (#41), and the
task system. Not yet started.

After that, the config items in II.10 are the gating factors for the Azizi
multi-site client to be fully live.

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
