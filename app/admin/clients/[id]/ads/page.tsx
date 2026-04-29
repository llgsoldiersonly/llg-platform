import { Megaphone } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'

export const dynamic = 'force-static'

export default async function ClientAdsPlaceholder({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return (
    <div className="mx-auto max-w-3xl p-12">
      <EmptyState
        icon={Megaphone}
        title="Google Ads — coming in v1.6"
        description="Per-client ad spend, conversions, and call-tracker attribution will appear here once the Google Ads integration ships. Until then, see the GLSA / Google Ads click-out cards on the client's credentials page."
        action={
          <Link href={`/admin/clients/${id}/credentials`}>
            <Button variant="outline" size="sm">Open credentials</Button>
          </Link>
        }
      />
    </div>
  )
}
