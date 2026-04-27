// Thin RingCentral Glip "Incoming Webhook" client. Each department channel
// has its own webhook URL — no OAuth involved.

export type GlipPayload = {
  text: string
  title?: string
  activity?: string
  attachments?: Array<{
    type: 'Card'
    color?: string
    title?: string
    text?: string
    intro?: string
    fallbackText?: string
  }>
}

export async function postToGlip(webhookUrl: string, payload: GlipPayload): Promise<void> {
  if (!webhookUrl) return  // No-op if not configured (dev environments without webhooks set)
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Glip webhook failed: ${res.status} — ${body.slice(0, 200)}`)
  }
}

export function ticketSummary(opts: {
  number: number
  type: 'bug' | 'request'
  subject: string
  client_firm: string
  priority: string
  url: string
}): GlipPayload {
  const colorByPriority: Record<string, string> = {
    urgent: '#DC2626',
    high: '#F97316',
    medium: '#FFA500',
    low: '#94A3B8',
  }
  const emoji = opts.type === 'bug' ? '🐞' : '📨'
  return {
    text: `${emoji} New ${opts.type} from ${opts.client_firm}: "${opts.subject}"`,
    title: `Ticket #${opts.number}`,
    activity: 'Client Ticket',
    attachments: [
      {
        type: 'Card',
        color: colorByPriority[opts.priority] ?? '#94A3B8',
        title: opts.subject,
        text: `Client: ${opts.client_firm}\nType: ${opts.type}\nPriority: ${opts.priority}`,
        intro: opts.url,
        fallbackText: `${opts.subject} — ${opts.url}`,
      },
    ],
  }
}
