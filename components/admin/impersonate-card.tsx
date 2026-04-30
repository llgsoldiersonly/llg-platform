import { Eye } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { startImpersonationFormAction } from '@/lib/actions/impersonation'

// Super-admin "View as client" trigger. Reason is required and gets logged
// to impersonation_log. After submit, super-admin lands on /overview with
// the banner showing across all client portal pages.
export function ImpersonateCard({
  clientId,
  clientName,
  errorMessage,
}: {
  clientId: string
  clientName: string
  errorMessage?: string
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Eye className="h-4 w-4 text-slate-600" />
          View as client
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-sm text-slate-600">
          Opens the client portal pinned to <strong>{clientName}</strong>. Useful for
          replicating a client&apos;s view of their own dashboard. Your actions while in
          this mode are recorded.
        </p>
        <form action={startImpersonationFormAction} className="space-y-3">
          <input type="hidden" name="client_id" value={clientId} />
          <div className="space-y-1.5">
            <Label htmlFor="impersonation-reason">Reason (required)</Label>
            <Input
              id="impersonation-reason"
              name="reason"
              required
              minLength={5}
              maxLength={200}
              placeholder="e.g. debugging Reiersen's missing call data"
            />
          </div>
          {errorMessage && (
            <p className="text-xs text-red-600">{errorMessage}</p>
          )}
          <Button type="submit" variant="default" className="w-full">
            Start viewing as {clientName}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
