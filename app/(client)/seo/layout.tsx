import { redirect } from 'next/navigation'
import { getClientContext } from '@/lib/client-context'
import { SeoTabNav } from './seo-tab-nav'

export default async function ClientSeoLayout({ children }: { children: React.ReactNode }) {
  // Intakes-only firms have no SEO surface — deep links bounce to /intakes.
  const ctx = await getClientContext()
  if (ctx?.client.intake_mode === 'intakes_only') redirect('/intakes')
  return (
    <div>
      <div className="border-b border-border-default bg-neutral-primary-soft">
        <div className="mx-auto max-w-6xl px-8 py-6">
          <p className="text-xs uppercase tracking-wide text-body">Search visibility</p>
          <h1 className="mt-1 text-2xl font-semibold text-heading">SEO Insights</h1>
          <p className="mt-1 text-sm text-body">
            Backlinks, keyword rankings, AI visibility, and competitor watch — refreshed weekly.
          </p>
          <div className="mt-6">
            <SeoTabNav />
          </div>
        </div>
      </div>
      <div>{children}</div>
    </div>
  )
}
