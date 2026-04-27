'use client'

import { useRouter, usePathname } from 'next/navigation'
import { Select } from '@/components/ui/select'

type ClientOption = {
  id: string
  firm_name: string
  is_demo_only: boolean
}

type Props = {
  clients: ClientOption[]
}

// URL-aware: extracts current client id from the pathname so the dropdown
// reflects which client the admin is currently drilled into. Switching
// preserves the same sub-path (credentials, deliverables, etc.) on the
// new client.
export function ClientSwitcher({ clients }: Props) {
  const router = useRouter()
  const pathname = usePathname()

  const match = pathname.match(/^\/admin\/clients\/([^/]+)(\/[^?]*)?$/)
  const currentClientId = match?.[1] ?? ''
  const subpath = match?.[2] ?? ''

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value
    if (!id) {
      router.push('/admin/clients')
      return
    }
    router.push(`/admin/clients/${id}${subpath}`)
  }

  return (
    <Select
      value={currentClientId}
      onChange={handleChange}
      aria-label="Switch client"
      className="w-64"
    >
      <option value="">All clients</option>
      {clients.map((c) => (
        <option key={c.id} value={c.id}>
          {c.firm_name}
          {c.is_demo_only ? ' (DEMO)' : ''}
        </option>
      ))}
    </Select>
  )
}
