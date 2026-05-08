// Vercel Cron Jobs invoke our routes with `Authorization: Bearer ${CRON_SECRET}`.
// Manual `curl` runs use `x-cron-secret`. Accept both so scheduled and manual
// triggers share a single auth check.
export function isAuthorizedCron(req: Request): boolean {
  if (!process.env.CRON_SECRET) return false
  const headerSecret = req.headers.get('x-cron-secret')
  const auth = req.headers.get('authorization') ?? ''
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : null
  const provided = headerSecret ?? bearer
  return provided === process.env.CRON_SECRET
}
