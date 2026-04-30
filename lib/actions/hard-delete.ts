'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSuperAdmin } from '@/lib/auth/rbac'
import { ok, err, type Result } from '@/lib/errors'
import { exportArchiveToStorage, type ArchiveData } from '@/lib/archive-export'

// Hard-deletes a client after archiving everything we know about them
// into client_archives. Cascade deletes via FKs do the rest. Type-firm-name
// confirmation guards against fat-fingers.
export async function hardDeleteClient(formData: FormData): Promise<Result<{ archive_id: number }>> {
  const clientId = formData.get('client_id')
  const confirmName = formData.get('confirm_firm_name')
  const reason = formData.get('reason')

  if (typeof clientId !== 'string' || !clientId) return err('VALIDATION_FAILED', 'Missing client_id')
  if (typeof confirmName !== 'string') return err('VALIDATION_FAILED', 'Missing confirm_firm_name')
  if (typeof reason !== 'string' || reason.trim().length < 10) {
    return err('VALIDATION_FAILED', 'Reason must be at least 10 characters')
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return err('UNAUTHORIZED')
  if (!isSuperAdmin(user)) return err('FORBIDDEN', 'Only super-admins can hard-delete clients')

  const admin = createAdminClient()

  const { data: client } = await admin
    .from('clients')
    .select('*')
    .eq('id', clientId)
    .maybeSingle()
  if (!client) return err('NOT_FOUND', 'Client does not exist')

  if (client.firm_name !== confirmName.trim()) {
    return err('VALIDATION_FAILED', `Firm name didn't match. Expected "${client.firm_name}".`)
  }

  // Build archive snapshot. Pull a year of time-series data; everything
  // else dumps in full. Errors on individual reads are non-fatal — we
  // still want to delete even if one source happens to be empty/missing.
  const cutoffIso = new Date(Date.now() - 365 * 24 * 3_600_000).toISOString()

  const tables = [
    { key: 'client_credentials',    query: admin.from('client_credentials').select('*').eq('client_id', clientId) },
    { key: 'client_locations',      query: admin.from('client_locations').select('*').eq('client_id', clientId) },
    { key: 'client_users',          query: admin.from('client_users').select('*').eq('client_id', clientId) },
    { key: 'subscriptions',         query: admin.from('subscriptions').select('*').eq('client_id', clientId) },
    { key: 'deliverables',          query: admin.from('deliverables').select('*, subscription:subscriptions!inner(client_id)').eq('subscription.client_id', clientId) },
    { key: 'tickets',               query: admin.from('tickets').select('*').eq('client_id', clientId) },
    { key: 'tasks',                 query: admin.from('tasks').select('*').eq('client_id', clientId) },
    { key: 'calls',                 query: admin.from('calls').select('*').eq('client_id', clientId).gte('started_at', cutoffIso) },
    { key: 'posts',                 query: admin.from('posts').select('*').eq('client_id', clientId).gte('published_at', cutoffIso) },
    { key: 'rankings_daily',        query: admin.from('rankings_daily').select('*').eq('client_id', clientId).gte('captured_on', cutoffIso.slice(0, 10)) },
    { key: 'citations',             query: admin.from('citations').select('*').eq('client_id', clientId) },
    { key: 'reviews',               query: admin.from('reviews').select('*').eq('client_id', clientId) },
    { key: 'gmb_snapshots',         query: admin.from('gmb_snapshots').select('*').eq('client_id', clientId) },
    { key: 'social_stats',          query: admin.from('social_stats').select('*').eq('client_id', clientId) },
    { key: 'monthly_snapshots',     query: admin.from('monthly_snapshots').select('*').eq('client_id', clientId) },
  ] as const

  const archive_data: Record<string, unknown> = { clients: client }
  for (const t of tables) {
    const { data } = await t.query
    archive_data[t.key] = data ?? []
  }

  const { data: archive, error: archiveErr } = await admin
    .from('client_archives')
    .insert({
      client_id: clientId,
      firm_name: client.firm_name,
      archived_by: user.id,
      reason: reason.trim(),
      archive_data,
    })
    .select('id')
    .single()
  if (archiveErr || !archive) {
    return err('INTERNAL', `Failed to write archive: ${archiveErr?.message ?? 'unknown'}`)
  }

  const { error: logErr } = await admin.from('activity_log').insert({
    actor_id: user.id,
    entity_type: 'client',
    entity_id: clientId,
    action: 'hard_deleted',
    before: { firm_name: client.firm_name },
    after: { archive_id: archive.id, reason: reason.trim() },
  })
  if (logErr) {
    return err('INTERNAL', `Archive id ${archive.id} written but activity_log insert failed: ${logErr.message}. Halting before delete to preserve audit trail.`)
  }

  // Cascade delete via FKs takes care of all child tables.
  const { error: deleteErr } = await admin
    .from('clients')
    .delete()
    .eq('id', clientId)
  if (deleteErr) {
    return err('INTERNAL', `Delete failed AFTER archive (id ${archive.id}): ${deleteErr.message}`)
  }

  // Export the archive as a ZIP to Supabase Storage and notify the actor.
  // Both steps are best-effort — failures here don't roll back the delete
  // (which is already done), but they do log so an operator can re-sign
  // from client_archives later if needed.
  try {
    const { signedUrl, path } = await exportArchiveToStorage(
      admin,
      archive.id,
      client.firm_name,
      archive_data as ArchiveData
    )
    await admin.from('notifications').insert({
      user_id: user.id,
      type: 'client_archive',
      subject: `Archive ready: ${client.firm_name}`,
      body:
        signedUrl
          ? `Hard-delete archive for ${client.firm_name} is ready. Download link expires in 30 days.`
          : `Hard-delete archive for ${client.firm_name} stored at ${path}. Signed-URL generation failed; re-sign via admin SDK.`,
      link: signedUrl ?? null,
    })
  } catch (exportErr) {
    const message = exportErr instanceof Error ? exportErr.message : 'unknown'
    await admin.from('activity_log').insert({
      actor_id: user.id,
      entity_type: 'client_archive',
      entity_id: clientId,
      action: 'export_failed',
      after: { archive_id: archive.id, error: message },
    })
  }

  revalidatePath('/admin/clients')
  return ok({ archive_id: archive.id })
}

export async function hardDeleteClientFormAction(formData: FormData) {
  const result = await hardDeleteClient(formData)
  if (!result.ok) {
    const clientId = formData.get('client_id')
    redirect(`/admin/clients/${clientId}?delete_error=${encodeURIComponent(result.error.message)}`)
  }
  redirect(`/admin/clients?deleted=${result.data.archive_id}`)
}
