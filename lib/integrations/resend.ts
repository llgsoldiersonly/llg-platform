// Minimal Resend sender for app-generated email (digests, summaries).
// Auth magic-links go through Supabase's SMTP config and do NOT use this.
//
// Requires RESEND_API_KEY in the environment (create one in the Resend
// dashboard for the llgportal.com domain). EMAIL_FROM overrides the default
// sender identity.

const FROM_DEFAULT = 'LLG Portal <spaceman@llgportal.com>'

export type SendEmailResult = { ok: true; id: string | null } | { ok: false; error: string }

export async function sendEmail(
  to: string | string[],
  subject: string,
  html: string
): Promise<SendEmailResult> {
  const key = process.env.RESEND_API_KEY
  if (!key) return { ok: false, error: 'RESEND_API_KEY is not configured' }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM ?? FROM_DEFAULT,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    return { ok: false, error: `Resend ${res.status}: ${body.slice(0, 300)}` }
  }
  const data = (await res.json().catch(() => null)) as { id?: string } | null
  return { ok: true, id: data?.id ?? null }
}
