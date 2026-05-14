import { Eye } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { startImpersonationFormAction } from '@/lib/actions/impersonation'

// Super-admin "View as client" trigger on the per-firm admin page.
// After submit, super-admin lands on /overview pinned to this client; the
// impersonation banner shows across all client portal pages.
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
          <Eye className="h-4 w-4 text-body" />
          View as client
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-sm text-body">
          Opens the client portal pinned to <strong>{clientName}</strong>. Useful for
          replicating a client&apos;s view of their own dashboard.
        </p>
        <form action={startImpersonationFormAction}>
          <input type="hidden" name="client_id" value={clientId} />
          {errorMessage && (
            <p className="mb-3 text-xs text-fg-danger">{errorMessage}</p>
          )}
          <Button type="submit" variant="default" className="w-full">
            Start viewing as {clientName}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
