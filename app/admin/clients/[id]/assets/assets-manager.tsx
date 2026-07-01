'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Download, Trash2, Upload, Paperclip } from 'lucide-react'
import { uploadClientAsset, deleteClientAsset, attachAssetToTask } from '@/lib/actions/assets'

export type ClientAsset = {
  id: string
  file_name: string
  size_bytes: number | null
  created_at: string
  task_id: string | null
}
export type TaskOption = { id: string; task_number: number; title: string }

function fmtSize(bytes: number | null): string {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function AssetsManager({
  clientId,
  assets,
  tasks,
}: {
  clientId: string
  assets: ClientAsset[]
  tasks: TaskOption[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const file = fileInput.current?.files?.[0]
    if (!file) {
      setError('Choose a file first.')
      return
    }
    const fd = new FormData()
    fd.set('client_id', clientId)
    fd.set('file', file)
    startTransition(async () => {
      const res = await uploadClientAsset(fd)
      if (res.ok) {
        if (fileInput.current) fileInput.current.value = ''
        router.refresh()
      } else setError(res.error.message)
    })
  }

  function handleDelete(id: string) {
    setError(null)
    startTransition(async () => {
      const res = await deleteClientAsset(id, clientId)
      if (res.ok) router.refresh()
      else setError(res.error.message)
    })
  }

  function handleAttach(assetId: string, taskId: string) {
    setError(null)
    startTransition(async () => {
      const res = await attachAssetToTask(assetId, clientId, taskId || null)
      if (res.ok) router.refresh()
      else setError(res.error.message)
    })
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleUpload} className="flex flex-wrap items-end gap-3 rounded-lg border border-border-default p-4">
        <div className="flex-1">
          <label htmlFor="asset-file" className="mb-1 block text-sm font-medium text-heading">
            Upload an asset (any file, up to 50MB)
          </label>
          <input
            id="asset-file"
            ref={fileInput}
            type="file"
            className="block w-full text-sm text-body file:mr-3 file:rounded file:border file:border-border-default file:bg-neutral-secondary-soft file:px-3 file:py-1.5 file:text-sm"
          />
        </div>
        <Button type="submit" disabled={pending}>
          <Upload className="h-4 w-4" />
          {pending ? 'Uploading…' : 'Upload'}
        </Button>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="rounded-lg border border-border-default">
        <div className="border-b border-border-default px-4 py-2 text-xs font-medium uppercase tracking-wide text-body">
          Assets ({assets.length}) — internal, not shown to the client
        </div>
        {assets.length === 0 ? (
          <p className="px-4 py-6 text-sm text-body">No assets uploaded yet.</p>
        ) : (
          <ul className="divide-y divide-border-light">
            {assets.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-heading">{a.file_name}</p>
                  <p className="text-xs text-body-subtle">
                    {new Date(a.created_at).toLocaleString()}
                    {a.size_bytes ? ` · ${fmtSize(a.size_bytes)}` : ''}
                  </p>
                </div>

                <div className="flex items-center gap-1 text-body-subtle">
                  <Paperclip className="h-3.5 w-3.5" />
                  <Select
                    value={a.task_id ?? ''}
                    onChange={(e) => handleAttach(a.id, e.target.value)}
                    disabled={pending}
                    className="w-48 text-xs"
                    aria-label="Attach to task"
                  >
                    <option value="">— not attached —</option>
                    {tasks.map((t) => (
                      <option key={t.id} value={t.id}>
                        #{t.task_number} {t.title}
                      </option>
                    ))}
                  </Select>
                </div>

                <a
                  href={`/api/assets/${a.id}/download`}
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
                  onClick={() => handleDelete(a.id)}
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
