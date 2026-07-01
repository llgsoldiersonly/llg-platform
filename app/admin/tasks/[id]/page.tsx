import { notFound } from 'next/navigation'
import { loadTaskDetail } from '@/lib/task-detail-data'
import { TaskDetail } from '@/components/admin/task-detail'

export const dynamic = 'force-dynamic'

export default async function AdminTaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const d = await loadTaskDetail(id)
  if (!d) notFound()
  return (
    <TaskDetail
      task={d.task}
      activity={d.activity}
      comments={d.comments}
      subtasks={d.subtasks}
      templates={d.templates}
      files={d.files}
      taskBase="/admin/tasks"
      backHref="/admin/tasks/board"
    />
  )
}
