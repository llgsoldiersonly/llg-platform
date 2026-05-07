import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

// Hosted on Vercel Blob (store: llg-platform-assets) — the source mp4 is
// 202 MB which exceeds GitHub's 100 MB per-file ceiling, so it can't live
// in /public. Re-upload via `vercel blob put ...` to the same pathname if
// the asset ever needs to be replaced; the URL stays stable.
const VIDEO_URL =
  'https://5mqokpkfed2vbwak.public.blob.vercel-storage.com/multichannel-marketing/lucrative-legal-overview.mp4'

export function FeatureVideoCard() {
  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle className="text-base">Legal Leads Multi-Channel Marketing Strategy</CardTitle>
        <p className="text-xs text-body">
          Quick Overview of Agency Insights on Our 5 Pillars of Marketing Success
        </p>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        <div className="aspect-video w-full bg-black">
          <video
            controls
            preload="metadata"
            playsInline
            className="h-full w-full"
            src={VIDEO_URL}
          >
            Your browser doesn&apos;t support embedded video. Download the file directly:{' '}
            <a href={VIDEO_URL}>lucrative-legal-overview.mp4</a>.
          </video>
        </div>
      </CardContent>
    </Card>
  )
}
