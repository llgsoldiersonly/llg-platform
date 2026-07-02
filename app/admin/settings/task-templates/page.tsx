import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAgencyStaff } from '@/lib/auth/rbac'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TemplateCreateForm } from './template-create-form'
import { TemplateDeleteButton } from './template-delete-button'

export const dynamic = 'force-dynamic'

type Template = { id: string; name: string; kind: string }
type Step = {
  template_id: string
  position: number
  title: string
  description: string | null
  assignee_rule: string | null
  assignee_id: string | null
  offset_days: number | null
}

export default async function TaskTemplatesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  if (!isAgencyStaff(user)) redirect('/admin/dashboard')

  const supa = createAdminClient()
  const [{ data: templates }, { data: steps }, { data: staff }] = await Promise.all([
    supa.from('task_templates').select('id, name, kind').order('name').returns<Template[]>(),
    supa
      .from('task_template_steps')
      .select('template_id, position, title, description, assignee_rule, assignee_id, offset_days')
      .order('position')
      .returns<Step[]>(),
    supa
      .from('profiles')
      .select('id, full_name')
      .in('role', ['agency_staff', 'super_admin'])
      .eq('is_active', true)
      .order('full_name')
      .returns<{ id: string; full_name: string | null }[]>(),
  ])

  const staffList = (staff ?? [])
    .filter((p) => p.full_name)
    .map((p) => ({ id: p.id, name: p.full_name as string }))
  const nameById = new Map(staffList.map((p) => [p.id, p.name]))

  const ruleLabel = (s: Step): string | null => {
    switch (s.assignee_rule) {
      case 'parent_assignee': return "parent's assignee"
      case 'department_lead': return 'department lead'
      case 'specific': return s.assignee_id ? nameById.get(s.assignee_id) ?? 'specific person' : null
      default: return null
    }
  }

  const stepsByTemplate = new Map<string, Step[]>()
  for (const s of steps ?? []) {
    const arr = stepsByTemplate.get(s.template_id) ?? []
    arr.push(s)
    stepsByTemplate.set(s.template_id, arr)
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-8">
      <div>
        <Link href="/admin/content-plans" className="text-sm text-fg-brand hover:underline">
          ← Content plans
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-heading">Workflow templates</h1>
        <p className="mt-1 text-sm text-body">
          Reusable step lists (like the blog 01–07 pipeline). Apply a template to any task to spawn
          its subtasks, or set one on a content plan so every row gets the workflow automatically.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">New template</CardTitle>
        </CardHeader>
        <CardContent>
          <TemplateCreateForm staff={staffList} />
        </CardContent>
      </Card>

      <div className="space-y-4">
        {(templates ?? []).length === 0 ? (
          <p className="text-sm text-body">No templates yet.</p>
        ) : (
          (templates ?? []).map((t) => (
            <Card key={t.id}>
              <CardHeader className="flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base">{t.name}</CardTitle>
                  <Badge variant="secondary">{t.kind}</Badge>
                </div>
                <TemplateDeleteButton templateId={t.id} name={t.name} />
              </CardHeader>
              <CardContent>
                <ol className="list-decimal space-y-1 pl-5 text-sm text-body">
                  {(stepsByTemplate.get(t.id) ?? []).map((s) => {
                    const who = ruleLabel(s)
                    return (
                      <li key={`${t.id}-${s.position}`}>
                        {s.title}
                        {(who || s.offset_days != null) && (
                          <span className="text-xs text-body-subtle">
                            {' '}
                            ({[who, s.offset_days != null ? `due +${s.offset_days}d` : null]
                              .filter(Boolean)
                              .join(' · ')})
                          </span>
                        )}
                        {s.description && (
                          <p className="mt-0.5 whitespace-pre-wrap text-xs text-body-subtle">{s.description}</p>
                        )}
                      </li>
                    )
                  })}
                </ol>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
