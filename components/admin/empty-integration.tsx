import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

type Props = {
  clientId: string
  serviceName: string
  reason: 'not_configured' | 'no_data'
  helpText?: string
}

// Reused empty-state for any per-client integration drill-in (calls,
// content, social, etc.). Distinguishes "we never set it up" from
// "set up but nothing has come in yet."
export function EmptyIntegration({ clientId, serviceName, reason, helpText }: Props) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 p-12 text-center">
        <p className="text-3xl font-semibold text-slate-300">N/A</p>
        {reason === 'not_configured' ? (
          <>
            <p className="text-sm font-medium text-slate-700">
              {serviceName} is not connected for this client yet.
            </p>
            <p className="max-w-md text-xs text-slate-600">
              {helpText ?? `Add the ${serviceName} credentials in the credentials tab to start syncing.`}
            </p>
            <Link href={`/admin/clients/${clientId}/credentials`}>
              <Button variant="outline" size="sm">Open credentials</Button>
            </Link>
          </>
        ) : (
          <>
            <p className="text-sm font-medium text-slate-700">
              {serviceName} is connected, but no data has come through yet.
            </p>
            <p className="max-w-md text-xs text-slate-600">
              {helpText ?? `Cron pulls run nightly. If this is the first day after setup, data will appear by tomorrow morning.`}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  )
}
