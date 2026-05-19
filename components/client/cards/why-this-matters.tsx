'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Sparkles, PlayCircle } from 'lucide-react'

const PRE_LAUNCH_BLOCKS = [
  {
    title: 'What is pre-launch?',
    body: 'Pre-launch is the foundational phase where we build the digital infrastructure for your firm — pages, profiles, and listings — before any marketing dollars activate.',
  },
  {
    title: 'Why is it important?',
    body: "Skipping or rushing pre-launch is the #1 cause of underperforming campaigns. Every page, profile, and link you see on the right is set up once, by hand, so you don't pay for ad clicks that go to a half-finished site.",
  },
]

const POST_LAUNCH_BLOCKS = [
  {
    title: 'Why our blogs matter',
    body: "Every blog targets a question your potential clients are actually searching. Each post strengthens your domain authority and gives Google a fresh page to rank — so you show up for more terms over time, not just the obvious ones.",
  },
  {
    title: 'Why our manual SEO works',
    body: "Our team does the work hands-on: research, on-page optimization, internal linking, and reviewing the analytics every cycle. No software-only shortcuts — that's why we can move the needle on the searches that actually convert.",
  },
  {
    title: 'What our FAQ pages do',
    body: 'FAQ pages capture the long-tail queries (the specific questions a person types late at night). They also feed Google\'s "People Also Ask" and AI-overview boxes — so when a prospect asks about your practice area, your firm is the source.',
  },
]

// Hosted on Vercel Blob (store: llg-platform-assets). Re-upload via
// `vercel blob put <local> --pathname tutorials/dashboard-tutorial.mp4 ...`
// to refresh; the URL stays stable.
const DASHBOARD_TUTORIAL_URL =
  'https://5mqokpkfed2vbwak.public.blob.vercel-storage.com/tutorials/dashboard-tutorial.mp4'

type Tab = 'about' | 'tutorial'

export function WhyThisMattersCard({ preLaunch }: { preLaunch: boolean }) {
  const [tab, setTab] = useState<Tab>('about')
  const blocks = preLaunch ? PRE_LAUNCH_BLOCKS : POST_LAUNCH_BLOCKS
  const aboutLabel = preLaunch ? 'About pre-launch' : 'About your monthly work'

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <div
          role="tablist"
          aria-label="Helpful context"
          className="flex items-center gap-1 rounded-md border border-border-default bg-neutral-secondary-soft p-1 text-xs"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'about'}
            onClick={() => setTab('about')}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded px-3 py-1.5 transition ${
              tab === 'about' ? 'bg-bg-default font-semibold text-fg-brand-strong shadow-sm' : 'text-body'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            {aboutLabel}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'tutorial'}
            onClick={() => setTab('tutorial')}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded px-3 py-1.5 transition ${
              tab === 'tutorial' ? 'bg-bg-default font-semibold text-fg-brand-strong shadow-sm' : 'text-body'
            }`}
          >
            <PlayCircle className="h-3.5 w-3.5" />
            Dashboard Tutorial
          </button>
        </div>

        {tab === 'about' ? (
          <div className="space-y-4">
            {blocks.map((b) => (
              <div key={b.title}>
                <h4 className="text-sm font-semibold text-heading">{b.title}</h4>
                <p className="mt-1 text-sm text-body">{b.body}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="aspect-video w-full overflow-hidden rounded-md bg-black">
              <video
                controls
                preload="metadata"
                playsInline
                className="h-full w-full"
                src={DASHBOARD_TUTORIAL_URL}
              >
                Your browser doesn&apos;t support embedded video. Download it directly:{' '}
                <a href={DASHBOARD_TUTORIAL_URL}>dashboard-tutorial.mp4</a>.
              </video>
            </div>
            <p className="text-xs text-body-subtle">
              A quick walkthrough of your dashboard — what each section means and where to find what.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
