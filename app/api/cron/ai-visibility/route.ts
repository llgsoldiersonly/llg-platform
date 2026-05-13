import { NextResponse } from 'next/server'
import { isAuthorizedCron } from '@/lib/cron-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { postToGlip } from '@/lib/integrations/ringcentral'
import { getLlmResponse, type LlmPlatform } from '@/lib/integrations/dataforseo/ai'
import { saveAiVisibilitySnapshot } from '@/lib/integrations/dataforseo/snapshots'
import { generatePromptsForFirm } from '@/lib/seo/ai-visibility-prompts'
import { gatherKeywordsForAiVisibility } from '@/lib/seo/ai-visibility-keyword-sources'

export const maxDuration = 300

// Platforms to query each prompt against. Scoped to chat_gpt for v1 — gemini
// failed on the first live run (likely needs a different default model_name)
// and adding it doubles total call count. Re-add once a working DFS model
// name is confirmed and we've validated parallelization budget headroom.
const PLATFORMS: LlmPlatform[] = ['chat_gpt']

// Maps the DFS platform code to the label we store in dfs_ai_visibility_snapshots.
// The /seo/ai page UI keys off these labels.
const PLATFORM_LABEL: Record<LlmPlatform, string> = {
  gemini: 'google_ai_mode',
  chat_gpt: 'chat_gpt',
  perplexity: 'perplexity',
}

// Monthly AI visibility sweep — runs 1st @ 01:00 UTC.
//
// For each active firm:
//   1. Source up to 6 keywords (top-10-ranking first, then high/medium priority)
//   2. Expand each into 3 natural-language framings = up to 18 prompts/firm
//   3. Fire all prompts × platforms in parallel for that firm (Promise.allSettled)
//   4. Save one row per (prompt × platform) into dfs_ai_visibility_snapshots
//
// Why parallel within firm: a single DFS LLM Responses call takes ~6-10s.
// Serial = 18 × 8s = 144s per firm × 6 firms = 14 min. Cap is 300s.
// Parallel within firm = ~10s per firm × 6 firms = 60s total. Comfortable
// headroom for growth + the occasional slow call.
//
// Idempotency: the snapshot table has no unique constraint on
// (client_id, month_key, platform, prompt) so multiple same-day runs append
// rather than replace. The /seo/ai page handles this naturally by filtering
// to month_key and treating duplicates as the most-recent value. If this
// becomes a problem we'll add a unique constraint + on-conflict-do-update.
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

    const sourcedKeywords = await gatherKeywordsForAiVisibility(supa, client.id, 6)
    if (sourcedKeywords.length === 0) continue

    const prompts = generatePromptsForFirm(sourcedKeywords)
    if (prompts.length === 0) continue

    // Fan out: all (prompt × platform) combos for this firm in parallel.
    const jobs: Array<Promise<{
      ok: boolean
      prompt: string
      tracked_keyword_id: string
      platform: LlmPlatform
      error?: string
      result?: Awaited<ReturnType<typeof getLlmResponse>>
    }>> = []

    for (const p of prompts) {
      for (const platform of PLATFORMS) {
        jobs.push(
          getLlmResponse(
            {
              prompt: p.prompt,
              targetDomain: client.primary_domain!,
              firmName: client.firm_name,
              platform,
              webSearchCountryIsoCode: 'US',
            },
            { client_id: client.id }
          )
            .then((result) => ({
              ok: true as const,
              prompt: p.prompt,
              tracked_keyword_id: p.tracked_keyword_id,
              platform,
              result,
            }))
            .catch((e) => ({
              ok: false as const,
              prompt: p.prompt,
              tracked_keyword_id: p.tracked_keyword_id,
              platform,
              error: e instanceof Error ? e.message : 'unknown',
            }))
        )
      }
    }

    const results = await Promise.all(jobs)

    // Write results sequentially — Supabase can handle the parallelism but
    // there's no upside to it for 18 small inserts, and serial keeps stats
    // counting accurate.
    for (const r of results) {
      if (!r.ok) {
        errors.push({
          client: client.firm_name,
          stage: `${r.platform}:${r.prompt.slice(0, 40)}`,
          message: r.error ?? 'unknown',
        })
        continue
      }
      try {
        await saveAiVisibilitySnapshot(supa, {
          clientId: client.id,
          trackedKeywordId: r.tracked_keyword_id,
          platform: PLATFORM_LABEL[r.platform],
          prompt: r.prompt,
          result: r.result!,
        })
        stats.prompts_run += 1
        if (r.result!.client_mentioned) stats.mentioned += 1
        if (r.result!.client_cited) stats.cited += 1
      } catch (e) {
        errors.push({
          client: client.firm_name,
          stage: `save:${r.prompt.slice(0, 40)}`,
          message: e instanceof Error ? e.message : 'unknown',
        })
      }
    }

    await supa.from('sync_log').insert({
      source: 'cron:ai-visibility',
      client_id: client.id,
      status: errors.some((e) => e.client === client.firm_name) ? 'partial' : 'ok',
      row_count: results.filter((r) => r.ok).length,
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
