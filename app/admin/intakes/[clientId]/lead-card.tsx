'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import { FileText, Image as ImageIcon, Trash2, Paperclip } from 'lucide-react'
import {
  updateIntakeLeadStatus,
  deleteIntakeLead,
  uploadIntakeFile,
  deleteIntakeFile,
  type IntakeLeadStatus,
} from '@/lib/actions/intakes'

export type IntakeLead = {
  id: string
  lead_name: string
  lead_phone: string | null
  date_of_loss: string | null
  at_fault_name: string | null
  at_fault_phone: string | null
  at_fault_license: string | null
  at_fault_insurance: string | null
  description: string | null
  status: string
  client_decision: string | null
  client_decision_at: string | null
  created_by: string | null
  created_at: string
}

const DECISION_BADGE: Record<string, 'success' | 'destructive' | 'warning'> = {
  accepted: 'success',
  not_accepted: 'destructive',
  disengaged: 'warning',
}
const DECISION_LABEL: Record<string, string> = {
  accepted: 'Firm: Accepted',
  not_accepted: 'Firm: Not accepted',
  disengaged: 'Firm: Disengaged',
}

export type IntakeFile = {
  id: string
  lead_id: string
  kind: 'retainer' | 'support'
  file_name: string
  size_bytes: number | null
  created_at: string
}

const STATUS_BADGE: Record<string, 'info' | 'success' | 'warning' | 'secondary'> = {
  new: 'info',
  retained: 'success',
  referred_out: 'warning',
  dropped: 'secondary',
}
const STATUS_LABEL: Record<string, string> = {
  new: 'New',
  retained: 'Retained',
  referred_out: 'Referred out',
  dropped: 'Dropped',
}

function sizeLabel(bytes: number | null): string {
  if (bytes == null) return ''
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

export function IntakeLeadCard({
  lead,
  files,
  createdByName,
  canDelete,
}: {
  lead: IntakeLead
  files: IntakeFile[]
  createdByName: string | null
  canDelete: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const retainerInput = useRef<HTMLInputElement>(null)
  const supportInput = useRef<HTMLInputElement>(null)

  const retainer = files.find((f) => f.kind === 'retainer') ?? null
  const support = files.filter((f) => f.kind === 'support')

  function run(fn: () => Promise<{ ok: boolean; error?: { message: string } }>) {
    setError(null)
    startTransition(async () => {
      const res = await fn()
      if (!res.ok && res.error) setError(res.error.message)
      router.refresh()
    })
  }

  function upload(kind: 'retainer' | 'support', fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    setError(null)
    startTransition(async () => {
      for (const f of Array.from(fileList)) {
        const fd = new FormData()
        fd.set('lead_id', lead.id)
        fd.set('kind', kind)
        fd.set('file', f)
        const res = await uploadIntakeFile(fd)
        if (!res.ok) {
          setError(`${f.name}: ${res.error.message}`)
          break
        }
      }
      router.refresh()
    })
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-medium text-heading">
              {lead.lead_name}
              {lead.lead_phone && <span className="ml-2 text-sm font-normal text-body">{lead.lead_phone}</span>}
            </p>
            <p className="text-xs text-body-subtle">
              {lead.date_of_loss ? `DoL ${lead.date_of_loss}` : 'DoL —'} · entered {lead.created_at.slice(0, 10)}
              {createdByName && ` by ${createdByName}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {lead.client_decision && (
              <Badge variant={DECISION_BADGE[lead.client_decision] ?? 'secondary'}>
                {DECISION_LABEL[lead.client_decision] ?? lead.client_decision}
              </Badge>
            )}
            <Badge variant={STATUS_BADGE[lead.status] ?? 'secondary'}>{STATUS_LABEL[lead.status] ?? lead.status}</Badge>
            <Select
              value={lead.status}
              onChange={(e) => run(() => updateIntakeLeadStatus(lead.id, e.target.value as IntakeLeadStatus))}
              disabled={pending}
              className="h-8 w-auto text-xs"
            >
              <option value="new">New</option>
              <option value="retained">Retained</option>
              <option value="referred_out">Referred out</option>
              <option value="dropped">Dropped</option>
            </Select>
            {canDelete && (
              <button
                type="button"
                className="text-body-subtle hover:text-fg-danger"
                title="Delete lead (super-admin)"
                onClick={() => {
                  if (window.confirm(`Delete lead "${lead.lead_name}" and all its files? This cannot be undone.`)) {
                    run(() => deleteIntakeLead(lead.id))
                  }
                }}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {(lead.at_fault_name || lead.at_fault_phone || lead.at_fault_license || lead.at_fault_insurance) && (
          <div className="rounded-md bg-neutral-secondary-soft p-3 text-sm">
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-body-subtle">At-fault party</p>
            <p className="text-body">
              {[
                lead.at_fault_name,
                lead.at_fault_phone,
                lead.at_fault_license && `DL ${lead.at_fault_license}`,
                lead.at_fault_insurance && `Ins: ${lead.at_fault_insurance}`,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
        )}

        {lead.description && <p className="whitespace-pre-wrap text-sm text-body">{lead.description}</p>}

        <div className="space-y-1.5 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-body-subtle">Retainer:</span>
            {retainer ? (
              <>
                <a href={`/api/intake-files/${retainer.id}/download`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-fg-brand hover:underline">
                  <FileText className="h-3.5 w-3.5" /> {retainer.file_name}
                </a>
                <span className="text-xs text-body-subtle">{sizeLabel(retainer.size_bytes)}</span>
              </>
            ) : (
              <span className="text-xs text-fg-warning-strong">not uploaded</span>
            )}
            <button type="button" className="text-xs text-fg-brand hover:underline" disabled={pending} onClick={() => retainerInput.current?.click()}>
              {retainer ? 'replace' : 'upload PDF'}
            </button>
            <input ref={retainerInput} type="file" accept=".pdf,application/pdf" className="hidden" onChange={(e) => upload('retainer', e.target.files)} />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-body-subtle">Docs:</span>
            {support.length === 0 && <span className="text-xs text-body-subtle">none</span>}
            {support.map((f) => (
              <span key={f.id} className="inline-flex items-center gap-1">
                <a href={`/api/intake-files/${f.id}/download`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-fg-brand hover:underline">
                  {f.file_name.toLowerCase().endsWith('.pdf') ? <FileText className="h-3.5 w-3.5" /> : <ImageIcon className="h-3.5 w-3.5" />}
                  {f.file_name}
                </a>
                <button
                  type="button"
                  className="text-body-subtle hover:text-fg-danger"
                  title="Remove document"
                  disabled={pending}
                  onClick={() => {
                    if (window.confirm(`Remove ${f.file_name}?`)) run(() => deleteIntakeFile(f.id))
                  }}
                >
                  ×
                </button>
              </span>
            ))}
            <button type="button" className="inline-flex items-center gap-1 text-xs text-fg-brand hover:underline" disabled={pending} onClick={() => supportInput.current?.click()}>
              <Paperclip className="h-3 w-3" /> add
            </button>
            <input ref={supportInput} type="file" multiple accept=".pdf,image/*" className="hidden" onChange={(e) => upload('support', e.target.files)} />
          </div>
        </div>

        {error && <p className="text-xs text-fg-danger">{error}</p>}
      </CardContent>
    </Card>
  )
}
