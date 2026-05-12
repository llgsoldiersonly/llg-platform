import { NextResponse } from 'next/server'
import { isAuthorizedCron } from '@/lib/cron-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { postToGlip } from '@/lib/integrations/ringcentral'
import { getLlmMentions } from '@/lib/integrations/dataforseo/ai'
import { saveAiVisibilitySnapshot } from '@/lib/integrations/dataforseo/snapshots'
import { generatePromptsForFirm, type TrackedKeywordForPrompt } from '@/lib/seo/ai-visibility-prompts'

// LLM Mentions API: ~$0.008/call. Budget = 16 calls/firm/month:
//   4 keywords × 2 prompts × 2 platforms (google AI Mode + chat_gpt).
// Cap maxDuration to keep us under Vercel's 5-minute hobby/pro hard limit.
export const maxDuration = 300

const PLATFORMS: Array<'google' | 'chat_gpt'> = ['google', 'chat_gpt']

// Monthly AI visibility sweep — runs 1st @ 01:00 UTC.
//
// For each active firm: pull top tracked_keywords (priority=high then medium,
// up to MAX_KEYWORDS_PER_FIRM=4), generate 2 prompts per keyword, then
// run each prompt against Google AI Mode + ChatGPT via DataForSEO's LLM
// Mentions API. Save one row per (prompt × platform) into
// dfs_ai_visibility_snapshots.
//
// Idempotency: the snapshot table is keyed on (client_id, snapshot_date,
// platform, prompt) functionally — re-running the same day just appends
// new rows. The /seo/ai page filters by month_key so a same-day re-run
// shows the most recent across all duplicates.
export async function POST(req: Request) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }
  if (!process.env.DATAFORSEO_API_KEY && !process.env.DATAFORSEO_LOGIN) {
    return NextResponse.json(
      { ok: false, error: 'DataForSEO credentials not configured.' },
      { status: 503 }
    )
  }

  const supa = createAdminClient()
  const start = Date.now()
  const errors: Array<{ client: string; stage: string; message: string }> = []
  const stats = {
    clients_processed: 0,
    prompts_run: 0,
    mentioned: 0,
    cited: 0,
  }

  const { data: clients, error: clientsErr } = await supa
    .from('clients')
    .select('id, firm_name, primary_domain')
    .eq('status', 'active')
    .eq('is_demo_only', false)
    .not('primary_domain', 'is', null)

  if (clientsErr) {
    return NextResponse.json({ ok: false, error: clientsErr.message }, { status: 500 })
  }

  for (const client of clients ?? []) {
    if (!client.primary_domain) continue
    stats.clients_processed += 1

    const { data: keywords } = await supa
      .from('dfs_tracked_keywords')
      .select('id, keyword, city, state, practice_area, priority')
      .eq('client_id', client.id)
      .eq('is_active', true)
      .in('priority', ['high', 'medium'])
      .order('priority', { ascending: true }) // 'high' < 'medium' alphabetically
      .limit(4)
      .returns<Array<TrackedKeywordForPrompt & { priority: string }>>()

    if (!keywords || keywords.length === 0) continue

    const prompts = generatePromptsForFirm(keywords)

    for (const p of prompts) {
      for (const platform of PLATFORMS) {
        try {
          const result = await getLlmMentions(
            {
              targetDomain: client.primary_domain,
              keyword: p.prompt,
              platform,
            },
            { client_id: client.id }
          )
          await saveAiVisibilitySnapshot(supa, {
            clientId: client.id,
            trackedKeywordId: p.tracked_keyword_id,
            platform: platform === 'google' ? 'google_ai_mode' : 'chat_gpt',
            prompt: p.prompt,
            result,
          })
          stats.prompts_run += 1
          if (result.client_mentioned) stats.mentioned += 1
          if (result.client_cited) stats.cited += 1
        } catch (e) {
          errors.push({
            client: client.firm_name,
            stage: `${platform}:${p.prompt.slice(0, 40)}`,
            message: e instanceof Error ? e.message : 'unknown',
          })
        }
      }
    }

    await supa.from('sync_log').insert({
      source: 'cron:ai-visibility',
      client_id: client.id,
      status: errors.some((e) => e.client === client.firm_name) ? 'partial' : 'ok',
      row_count: prompts.length * PLATFORMS.length,
    })
  }

  if (errors.length > 0 && process.env.RC_WEBHOOK_ALERTS) {
    try {
      await postToGlip(process.env.RC_WEBHOOK_ALERTS, {
        text: `⚠️ AI visibility cron — ${errors.length} error(s) across ${stats.clients_processed} client(s)`,
        activity: 'Cron error',
      })
    } catch {}
  }

  return NextResponse.json({
    ok: true,
    stats,
    errors: errors.slice(0, 20),
    error_count: errors.length,
    duration_ms: Date.now() - start,
  })
}

export const GET = POST
