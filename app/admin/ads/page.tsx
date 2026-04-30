import { Megaphone } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'

export const dynamic = 'force-dynamic'

export default function AdminAdsPlaceholder() {
  return (
    <div className="mx-auto max-w-3xl p-12">
      <EmptyState
        icon={Megaphone}
        title="Google Ads — coming in v1.6"
        description="Cross-client ad performance, spend, and lead-source attribution will live here. We'll wire it after pilots have at least 30 days of CallRail conversion data so the cost-per-lead numbers are meaningful."
      />
    </div>
  )
}
