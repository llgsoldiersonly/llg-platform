import { redirect } from 'next/navigation'
import { getClientContext } from '@/lib/client-context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { NewTicketForm } from './new-ticket-form'

export const dynamic = 'force-dynamic'

export default async function NewTicketPage() {
  const ctx = await getClientContext()
  if (!ctx) redirect('/login')

  return (
    <div className="mx-auto max-w-2xl p-8">
      <Card>
        <CardHeader>
          <CardTitle>New ticket</CardTitle>
          <p className="text-sm text-body">
            Bug = something's broken on our end. Request = something new you'd like us to do.
            Bugs are always free; requests count against your weekly quota.
          </p>
        </CardHeader>
        <CardContent>
          <NewTicketForm clientId={ctx.client.id} />
        </CardContent>
      </Card>
    </div>
  )
}
