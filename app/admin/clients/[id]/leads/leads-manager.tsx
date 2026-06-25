'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Download, Trash2, Upload } from 'lucide-react'
import { setClientLeadsEnabled, uploadLeadFile, deleteLeadFile } from '@/lib/actions/leads'

export type LeadFile = {
  id: string
  file_name: string
  size_bytes: number | null
  created_at: string
}

function fmtSize(bytes: number | null): string {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function LeadsManager({
  clientId,
  enabled,
  files,
}: {
  clientId: string
  enabled: boolean
  files: LeadFile[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [isEnabled, setIsEnabled] = useState(enabled)
  const fileInput = useRef<HTMLInputElement>(null)

  function toggle() {
    setError(null)
    const next = !isEnabled
    setIsEnabled(next) // optimistic
    startTransition(async () => {
      const res = await setClientLeadsEnabled(clientId, next)
      if (!res.ok) {
        setIsEnabled(!next)
        setError(res.error.message)
      } else {
        router.refresh()
      }
    })
  }

  function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const file = fileInput.current?.files?.[0]
    if (!file) {
      setError('Choose a PDF first.')
      return
    }
    const fd = new FormData()
    fd.set('client_id', clientId)
    fd.set('file', file)
    startTransition(async () => {
      const res = await uploadLeadFile(fd)
      if (res.ok) {
        if (fileInput.current) fileInput.current.value = ''
        router.refresh()
      } else {
        setError(res.error.message)
      }
    })
  }

  function handleDelete(id: string) {
    setError(null)
    startTransition(async () => {
      const res = await deleteLeadFile(id, clientId)
      if (res.ok) router.refresh()
      else setError(res.error.message)
    })
  }

  return (
    <div className="space-y-6">
      {/* Toggle */}
      <div className="flex items-center justify-between rounded-lg border border-border-default p-4">
        <div>
          <p className="font-medium text-heading">Leads box on client portal</p>
          <p className="text-sm text-body">
            When on, this client sees a downloadable Leads box above Monthly production.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={isEnabled ? 'success' : 'secondary'}>{isEnabled ? 'On' : 'Off'}</Badge>
          <Button type="button" variant={isEnabled ? 'outline' : 'default'} size="sm" disabled={pending} onClick={toggle}>
            {isEnabled ? 'Turn off' : 'Turn on'}
          </Button>
        </div>
      </div>

      {/* Upload */}
      <form onSubmit={handleUpload} className="flex flex-wrap items-end gap-3 rounded-lg border border-border-default p-4">
        <div className="flex-1">
          <label htmlFor="lead-file" className="mb-1 block text-sm font-medium text-heading">
            Upload a lead PDF
          </label>
          <input
            id="lead-file"
            ref={fileInput}
            type="file"
            accept="application/pdf"
            className="block w-full text-sm text-body file:mr-3 file:rounded file:border file:border-border-default file:bg-neutral-secondary-soft file:px-3 file:py-1.5 file:text-sm"
          />
        </div>
        <Button type="submit" disabled={pending}>
          <Upload className="h-4 w-4" />
          {pending ? 'Uploading…' : 'Upload'}
        </Button>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* File list */}
      <div className="rounded-lg border border-border-default">
        <div className="border-b border-border-default px-4 py-2 text-xs font-medium uppercase tracking-wide text-body">
          Uploaded leads ({files.length})
        </div>
        {files.length === 0 ? (
          <p className="px-4 py-6 text-sm text-body">No lead PDFs uploaded yet.</p>
        ) : (
          <ul className="divide-y divide-border-light">
            {files.map((f) => (
              <li key={f.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-heading">{f.file_name}</p>
                  <p className="text-xs text-body-subtle">
                    {new Date(f.created_at).toLocaleString()}
                    {f.size_bytes ? ` · ${fmtSize(f.size_bytes)}` : ''}
                  </p>
                </div>
                <a
                  href={`/api/leads/${f.id}/download`}
                  className="inline-flex items-center gap-1 text-sm text-fg-brand hover:underline"
                >
                  <Download className="h-4 w-4" />
                  Download
                </a>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={pending}
                  onClick={() => handleDelete(f.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
