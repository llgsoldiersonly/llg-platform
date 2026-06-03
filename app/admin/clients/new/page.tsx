import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { Card, CardContent } from '@/components/ui/card'
import { NewClientForm } from './new-client-form'

export const dynamic = 'force-dynamic'

type PackageOption = {
  id: string
  code: string
  display_name: string
  tier_order: number
}

export default async function NewClientPage() {
  const supa = createAdminClient()
  const { data: packages, error } = await supa
    .from('package_templates')
    .select('id, code, display_name, tier_order')
    .order('tier_order', { ascending: true })
    .returns<PackageOption[]>()

  return (
    <div className="mx-auto max-w-3xl p-8">
      <Link
        href="/admin/clients"
        className="mb-4 inline-flex items-center gap-1 text-sm text-body-subtle hover:text-body"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to clients
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-heading">New client</h1>
        <p className="mt-1 text-sm text-body">
          Creates the firm, its primary location, and the first subscription. Onboarding tasks are
          generated automatically; deliverables populate on the next monthly rollover.
        </p>
      </div>

      <Card>
        <CardContent className="p-6">
          {error ? (
            <p className="text-sm text-fg-danger">Failed to load packages: {error.message}</p>
          ) : (
            <NewClientForm packages={packages ?? []} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
