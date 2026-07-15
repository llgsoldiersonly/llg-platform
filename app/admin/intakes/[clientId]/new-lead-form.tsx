'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { createIntakeLead, uploadIntakeFile } from '@/lib/actions/intakes'

// One form, everything the intake team captures on a call: the lead, the
// at-fault party, the accident, the signed retainer (PDF), and any
// supporting docs (PDF/photos). Files upload right after the lead row is
// created, so a network failure can't orphan uploads without a lead.
export function NewIntakeLeadForm({ clientId }: { clientId: string }) {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  function onSubmit(formData: FormData) {
    setError(null)
    setNotice(null)
    startTransition(async () => {
      const created = await createIntakeLead({
        client_id: clientId,
        lead_name: String(formData.get('lead_name') ?? '').trim(),
        lead_phone: (formData.get('lead_phone') as string) || null,
        date_of_loss: (formData.get('date_of_loss') as string) || null,
        at_fault_name: (formData.get('at_fault_name') as string) || null,
        at_fault_phone: (formData.get('at_fault_phone') as string) || null,
        at_fault_license: (formData.get('at_fault_license') as string) || null,
        at_fault_insurance: (formData.get('at_fault_insurance') as string) || null,
        description: (formData.get('description') as string) || null,
      })
      if (!created.ok) {
        setError(created.error.message)
        return
      }

      const failures: string[] = []
      const retainer = formData.get('retainer')
      if (retainer instanceof File && retainer.size > 0) {
        const fd = new FormData()
        fd.set('lead_id', created.data.id)
        fd.set('kind', 'retainer')
        fd.set('file', retainer)
        const res = await uploadIntakeFile(fd)
        if (!res.ok) failures.push(`retainer: ${res.error.message}`)
      }
      const support = formData.getAll('support').filter((f): f is File => f instanceof File && f.size > 0)
      for (const f of support) {
        const fd = new FormData()
        fd.set('lead_id', created.data.id)
        fd.set('kind', 'support')
        fd.set('file', f)
        const res = await uploadIntakeFile(fd)
        if (!res.ok) failures.push(`${f.name}: ${res.error.message}`)
      }

      if (failures.length > 0) {
        setError(`Lead saved, but some files failed — ${failures.join(' · ')}. Re-upload them on the lead below.`)
      } else {
        setNotice('Lead saved.')
        formRef.current?.reset()
        setOpen(false)
      }
      router.refresh()
    })
  }

  if (!open) {
    return (
      <div className="flex items-center gap-3">
        <Button onClick={() => setOpen(true)}>+ New lead</Button>
        {notice && <span className="text-sm text-fg-success-strong">{notice}</span>}
      </div>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">New lead</CardTitle>
      </CardHeader>
      <CardContent>
        <form ref={formRef} action={onSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2 sm:col-span-1">
              <Label htmlFor="lead_name">Lead name *</Label>
              <Input id="lead_name" name="lead_name" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lead_phone">Phone</Label>
              <Input id="lead_phone" name="lead_phone" type="tel" placeholder="(555) 555-5555" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date_of_loss">Date of loss (DoL)</Label>
              <Input id="date_of_loss" name="date_of_loss" type="date" />
            </div>
          </div>

          <fieldset className="rounded-md border border-border-default p-3">
            <legend className="px-1 text-xs font-medium uppercase tracking-wide text-body-subtle">
              At-fault party
            </legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="at_fault_name">Name</Label>
                <Input id="at_fault_name" name="at_fault_name" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="at_fault_phone">Phone</Label>
                <Input id="at_fault_phone" name="at_fault_phone" type="tel" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="at_fault_license">Driver&apos;s license #</Label>
                <Input id="at_fault_license" name="at_fault_license" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="at_fault_insurance">Insurance (carrier / policy #)</Label>
                <Input id="at_fault_insurance" name="at_fault_insurance" />
              </div>
            </div>
          </fieldset>

          <div className="space-y-2">
            <Label htmlFor="description">Description of the accident</Label>
            <Textarea id="description" name="description" rows={4} placeholder="What happened, where, injuries, treatment so far…" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="retainer">Signed retainer (PDF)</Label>
              <Input id="retainer" name="retainer" type="file" accept=".pdf,application/pdf" />
              <p className="text-xs text-body-subtle">Uploading a retainer marks the lead Retained automatically.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="support">Supporting docs (PDF or photos, multiple)</Label>
              <Input id="support" name="support" type="file" multiple accept=".pdf,image/*" />
              <p className="text-xs text-body-subtle">Medical records, police report, scene photos…</p>
            </div>
          </div>

          {error && <p className="rounded-md bg-danger-soft p-3 text-sm text-fg-danger-strong">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Saving…' : 'Save lead'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
