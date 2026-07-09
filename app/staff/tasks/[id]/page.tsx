import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { loadTaskDetail } from '@/lib/task-detail-data'
import { TaskDetail } from '@/components/admin/task-detail'

export const dynamic = 'force-dynamic'

export default async function StaffTaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const [{ data: { user } }, d] = await Promise.all([supabase.auth.getUser(), loadTaskDetail(id)])
  if (!d) notFound()
  return (
    <TaskDetail
      task={d.task}
      activity={d.activity}
      comments={d.comments}
      subtasks={d.subtasks}
      templates={d.templates}
      files={d.files}
      mentionables={d.mentionables}
      clientContext={d.clientContext}
      submitPrefill={d.submitPrefill}
      watchers={d.watchers}
      viewerId={user?.id ?? null}
      taskBase="/staff/tasks"
      backHref="/staff/board"
    />
  )
}
