import { SeoTabNav } from './seo-tab-nav'

export default function ClientSeoLayout({ children }: { children: React.ReactNode }) {
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
