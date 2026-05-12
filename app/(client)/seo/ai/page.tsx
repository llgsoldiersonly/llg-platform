import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getClientContext } from '@/lib/client-context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { Bot, CheckCircle2, XCircle } from 'lucide-react'

export const dynamic = 'force-dynamic'

type AiRow = {
  id: string
  snapshot_date: string
  month_key: string
  platform: string
  prompt: string
  client_mentioned: boolean
  client_cited: boolean
  client_mention_count: number
  competitor_mentions: unknown
  top_domains: unknown
}

const PLATFORM_LABELS: Record<string, string> = {
  google_ai_mode: 'Google AI Mode',
  chat_gpt: 'ChatGPT',
  llm_mentions: 'LLM mentions',
  perplexity: 'Perplexity',
  claude: 'Claude',
}

export default async function SeoAiVisibilityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (typeof v === 'string') sp.set(k, v)

  const ctx = await getClientContext(sp)
  if (!ctx) redirect('/login')

  const admin = createAdminClient()
  const monthKey = new Date().toISOString().slice(0, 7)

  const { data: rows } = await admin
    .from('dfs_ai_visibility_snapshots')
    .select('id, snapshot_date, month_key, platform, prompt, client_mentioned, client_cited, client_mention_count, competitor_mentions, top_domains')
    .eq('client_id', ctx.client.id)
    .eq('month_key', monthKey)
    .order('platform', { ascending: true })
    .order('prompt', { ascending: true })
    .returns<AiRow[]>()

  const totalPrompts = rows?.length ?? 0
  const mentioned = (rows ?? []).filter((r) => r.client_mentioned).length
  const cited = (rows ?? []).filter((r) => r.client_cited).length

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-8 py-8">
      <div>
        <h1 className="text-2xl font-semibold text-heading">AI Visibility</h1>
        <p className="mt-1 text-sm text-body">
          When prospects ask AI tools &ldquo;who&apos;s a good lawyer for X in [your city]?&rdquo;,
          do they hear about you? This page tracks how often you&apos;re named, cited, or
          linked across Google AI Mode, ChatGPT, and other AI surfaces.
        </p>
      </div>

      {totalPrompts === 0 ? (
        <EmptyState
          icon={Bot}
          title="AI visibility tracking isn't live yet"
          description="We're getting the first round of AI prompts set up for your firm. Each month we test a curated set of questions a potential client would ask an AI assistant about your practice area in your service area — and log whether your firm shows up, gets cited, or gets passed over. First snapshot should land within the next billing cycle."
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Kpi label="Prompts tested" value={totalPrompts} />
            <Kpi label="Times mentioned" value={mentioned} suffix={` / ${totalPrompts}`} />
            <Kpi label="Times cited (with link)" value={cited} suffix={` / ${totalPrompts}`} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">This month&apos;s prompts</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y divide-border-light">
                {rows?.map((r) => (
                  <li key={r.id} className="grid grid-cols-12 items-start gap-3 px-6 py-4">
                    <div className="col-span-8">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">
                          {PLATFORM_LABELS[r.platform] ?? r.platform}
                        </Badge>
                        <span className="text-xs text-body-subtle">
                          {new Date(r.snapshot_date).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="mt-1.5 text-sm text-heading">{r.prompt}</p>
                    </div>
                    <div className="col-span-4 flex items-center justify-end gap-3">
                      <ResultPill
                        ok={r.client_mentioned}
                        okText="Mentioned"
                        notText="Not mentioned"
                      />
                      {r.client_mentioned && (
                        <ResultPill
                          ok={r.client_cited}
                          okText="Cited"
                          notText="No citation"
                          neutralIfNotMentioned={!r.client_mentioned}
                        />
                      )}
                    </div>
                  </li>
                )) ?? null}
              </ul>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

function Kpi({ label, value, suffix }: { label: string; value: number; suffix?: string }) {
  return (
    <Card>
      <CardContent className="py-4">
        <div className="text-xs uppercase tracking-wide text-body">{label}</div>
        <div className="mt-1 text-2xl font-semibold tabular-nums text-heading">
          {value}
          {suffix && <span className="text-base font-normal text-body">{suffix}</span>}
        </div>
      </CardContent>
    </Card>
  )
}

function ResultPill({
  ok,
  okText,
  notText,
  neutralIfNotMentioned,
}: {
  ok: boolean
  okText: string
  notText: string
  neutralIfNotMentioned?: boolean
}) {
  if (neutralIfNotMentioned) return null
  if (ok) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
        <CheckCircle2 className="h-3.5 w-3.5" />
        {okText}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-body">
      <XCircle className="h-3.5 w-3.5 text-fg-disabled" />
      {notText}
    </span>
  )
}
