'use client'

import { useState, useTransition } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  createClientSite,
  updateClientSite,
  setPrimaryClientSite,
  deleteClientSite,
} from '@/lib/actions/client-sites'

export type ClientSite = {
  id: string
  domain: string
  label: string | null
  purpose: string | null
  is_primary: boolean
  is_active: boolean
}

export function ClientSitesCard({
  clientId,
  sites,
}: {
  clientId: string
  sites: ClientSite[]
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [newDomain, setNewDomain] = useState('')
  const [newLabel, setNewLabel] = useState('')

  function run(fn: () => Promise<{ ok: boolean; error?: { message: string } }>) {
    setError(null)
    startTransition(async () => {
      const res = await fn()
      if (!res.ok) setError(res.error?.message ?? 'Something went wrong')
    })
  }

  function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!newDomain.trim()) return
    run(async () => {
      const res = await createClientSite({
        client_id: clientId,
        domain: newDomain,
        label: newLabel,
      })
      if (res.ok) {
        setNewDomain('')
        setNewLabel('')
      }
      return res
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Tracked websites</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-body-subtle">
          Domains we monitor for this client (SEO rankings, backlinks, site health, blog sync). The{' '}
          <strong>primary</strong> site backs the legacy <code>primary_domain</code>. Local
          (GBP/citations) and ads/intakes are tracked per-location and aren&apos;t affected here.
        </p>

        {sites.length === 0 ? (
          <p className="text-sm text-body">No websites yet — add one below.</p>
        ) : (
          <ul className="divide-y divide-border-default rounded border border-border-default">
            {sites.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                <span className="font-medium text-heading">{s.domain}</span>
                {s.label && <span className="text-xs text-body-subtle">{s.label}</span>}
                {s.is_primary && <Badge variant="secondary">Primary</Badge>}
                {!s.is_active && <Badge variant="destructive">Inactive</Badge>}
                <div className="ml-auto flex items-center gap-2">
                  {!s.is_primary && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={pending}
                      onClick={() => run(() => setPrimaryClientSite({ id: s.id, client_id: clientId }))}
                    >
                      Make primary
                    </Button>
                  )}
                  {!s.is_primary && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={pending}
                      onClick={() =>
                        run(() =>
                          updateClientSite({
                            id: s.id,
                            client_id: clientId,
                            is_active: !s.is_active,
                          }),
                        )
                      }
                    >
                      {s.is_active ? 'Deactivate' : 'Activate'}
                    </Button>
                  )}
                  {!s.is_primary && (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      disabled={pending}
                      onClick={() => run(() => deleteClientSite({ id: s.id, client_id: clientId }))}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-2">
          <div className="min-w-[200px] flex-1">
            <Label htmlFor="site-domain">Add a website</Label>
            <Input
              id="site-domain"
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              placeholder="azizilawfirm.com"
            />
          </div>
          <div className="min-w-[140px]">
            <Label htmlFor="site-label">Label (optional)</Label>
            <Input
              id="site-label"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="GBP site"
            />
          </div>
          <Button type="submit" disabled={pending || !newDomain.trim()}>
            {pending ? 'Saving…' : 'Add site'}
          </Button>
        </form>

        {error && <p className="text-sm text-red-600">{error}</p>}
      </CardContent>
    </Card>
  )
}
