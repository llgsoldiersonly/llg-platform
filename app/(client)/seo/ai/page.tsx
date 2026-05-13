import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getClientContext } from '@/lib/client-context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { Bot, CheckCircle2, XCircle, ExternalLink, Sparkles } from 'lucide-react'

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
  client_citation_urls: unknown
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
    .select('id, snapshot_date, month_key, platform, prompt, client_mentioned, client_cited, client_mention_count, client_citation_urls')
    .eq('client_id', ctx.client.id)
    .eq('month_key', monthKey)
    .order('platform', { ascending: true })
    .order('prompt', { ascending: true })
    .returns<AiRow[]>()

  const allRows = rows ?? []
  const totalPrompts = allRows.length
  const mentionedRows = allRows.filter((r) => r.client_mentioned)
  const citedRows = allRows.filter((r) => r.client_cited)
  // "Winning" = the firm showed up in some form. Cited is stronger signal
  // than mentioned (an actual link, not just a name-drop), so list cited
  // first.
  const winningRows = [
    ...citedRows,
    ...mentionedRows.filter((r) => !r.client_cited),
  ]

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
            <Kpi label="Times mentioned" value={mentionedRows.length} suffix={` / ${totalPrompts}`} />
            <Kpi label="Times cited (with link)" value={citedRows.length} suffix={` / ${totalPrompts}`} />
          </div>

          {/* Featured: the prompts that actually surfaced the firm. Most valuable
              view for the client — concrete evidence the work is paying off. */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-fg-brand" />
                <CardTitle className="text-base">Where you&apos;re showing up</CardTitle>
              </div>
              <p className="mt-1 text-xs text-body">
                The prompts where AI assistants actually surfaced your firm this month.
              </p>
            </CardHeader>
            <CardContent className="p-0">
              {winningRows.length === 0 ? (
                <div className="px-6 py-8 text-center">
                  <p className="text-sm text-body">
                    No mentions yet this month across the {totalPrompts} prompts we tested.
                  </p>
                  <p className="mt-1 text-xs text-body-subtle">
                    AI visibility builds over time as your domain authority, citations, and review profile grow.
                    Our team prioritizes work that influences AI surfaces: structured FAQ pages, GBP optimization,
                    and authoritative backlinks.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-border-light">
                  {winningRows.map((r) => (
                    <FeaturedRow key={r.id} row={r} />
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Full list of every prompt we tested, including the misses, so the
              client can see gaps. */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">All prompts tested</CardTitle>
              <p className="mt-1 text-xs text-body">
                Every prompt run against AI assistants this month, including the ones that didn&apos;t surface your firm.
                These are the gaps we&apos;re working to close.
              </p>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y divide-border-light">
                {allRows.map((r) => (
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
                          notText="No link"
                        />
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

function FeaturedRow({ row }: { row: AiRow }) {
  const citationUrls = Array.isArray(row.client_citation_urls)
    ? (row.client_citation_urls as string[]).filter((u) => typeof u === 'string')
    : []

  return (
    <li className="px-6 py-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">
              {PLATFORM_LABELS[row.platform] ?? row.platform}
            </Badge>
            {row.client_cited ? (
              <Badge variant="success">Cited with link</Badge>
            ) : (
              <Badge variant="info">Mentioned by name</Badge>
            )}
            <span className="text-xs text-body-subtle">
              {new Date(row.snapshot_date).toLocaleDateString()}
            </span>
          </div>
          <p className="mt-1.5 text-sm font-medium text-heading">{row.prompt}</p>
          {citationUrls.length > 0 && (
            <div className="mt-2 space-y-1">
              {citationUrls.slice(0, 3).map((url, i) => (
                <a
                  key={i}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex max-w-full items-center gap-1 text-xs text-fg-brand hover:underline"
                >
                  <span className="truncate">{url}</span>
                  <ExternalLink className="h-3 w-3 shrink-0" />
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </li>
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
}: {
  ok: boolean
  okText: string
  notText: string
}) {
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
