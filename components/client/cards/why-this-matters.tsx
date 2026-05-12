import { Card, CardContent } from '@/components/ui/card'
import { Sparkles } from 'lucide-react'

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

export function WhyThisMattersCard({ preLaunch }: { preLaunch: boolean }) {
  const blocks = preLaunch ? PRE_LAUNCH_BLOCKS : POST_LAUNCH_BLOCKS
  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-fg-brand" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-fg-brand-strong">
            {preLaunch ? 'About pre-launch' : 'About your monthly work'}
          </h3>
        </div>
        <div className="space-y-4">
          {blocks.map((b) => (
            <div key={b.title}>
              <h4 className="text-sm font-semibold text-heading">{b.title}</h4>
              <p className="mt-1 text-sm text-body">{b.body}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
