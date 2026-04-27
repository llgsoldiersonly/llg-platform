'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAgencyStaff } from '@/lib/auth/rbac'
import { ok, err, type Result } from '@/lib/errors'
import { getQuotaState, incrementRequestUsage, resolveClientTier } from '@/lib/tickets/quota'
import { slaDeadlineFor } from '@/lib/business-hours'
import { postToGlip, ticketSummary } from '@/lib/integrations/ringcentral'

type Priority = 'low' | 'medium' | 'high' | 'urgent'

export type CreateTicketInput = {
  client_id: string
  type: 'bug' | 'request'
  subject: string
  category: string
  priority: Priority
  body: string
}

export async function createTicket(input: CreateTicketInput): Promise<Result<{ id: string; ticket_number: number }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return err('UNAUTHORIZED')

  if (!input.subject?.trim()) return err('VALIDATION_FAILED', 'Subject is required.')
  if (!input.body?.trim()) return err('VALIDATION_FAILED', 'Description is required.')

  const admin = createAdminClient()

  // Verify client_id belongs to user (or user is staff)
  if (!isAgencyStaff(user)) {
    const { data: membership } = await admin
      .from('client_users')
      .select('client_id')
      .eq('user_id', user.id)
      .eq('client_id', input.client_id)
      .maybeSingle()
    if (!membership) return err('FORBIDDEN', 'You do not have access to this client.')
  }

  // One-at-a-time per type: only one open ticket of this type allowed.
  const { data: existingOpen } = await admin
    .from('tickets')
    .select('id')
    .eq('client_id', input.client_id)
    .eq('type', input.type)
    .in('status', ['open', 'in_progress', 'waiting_on_client'])
    .limit(1)
  if (existingOpen && existingOpen.length > 0) {
    return err('TICKET_ALREADY_OPEN')
  }

  // Quota check for requests only. Bugs always allowed.
  let quota_charged = false
  if (input.type === 'request') {
    const state = await getQuotaState(admin, input.client_id)
    if (state.remaining !== 'unlimited' && state.remaining <= 0) {
      return err('QUOTA_EXCEEDED')
    }
    quota_charged = true
  }

  // Look up routing + tier for SLA
  const [routingRes, settingsRes, tierCode] = await Promise.all([
    admin
      .from('ticket_routing_rules')
      .select('department_id, glip_webhook_url')
      .eq('category', input.category)
      .eq('active', true)
      .maybeSingle(),
    admin.from('platform_settings').select('*').eq('id', 1).maybeSingle(),
    resolveClientTier(admin, input.client_id),
  ])

  const settings = settingsRes.data
  const sla_deadline_at = settings && tierCode
    ? slaDeadlineFor(new Date(), tierCode, input.priority, settings).toISOString()
    : null

  const { data: inserted, error: insertErr } = await admin
    .from('tickets')
    .insert({
      client_id: input.client_id,
      created_by: user.id,
      type: input.type,
      subject: input.subject.trim(),
      category: input.category,
      priority: input.priority,
      status: 'open',
      assigned_department_id: routingRes.data?.department_id ?? null,
      sla_deadline_at,
      quota_charged,
    })
    .select('id, ticket_number')
    .single()
  if (insertErr || !inserted) {
    return err('INTERNAL', `Failed to create ticket: ${insertErr?.message ?? 'unknown'}`)
  }

  // Insert opening message (the body)
  await admin.from('ticket_messages').insert({
    ticket_id: inserted.id,
    author_id: user.id,
    body: input.body.trim(),
    is_internal_note: false,
  })

  // Bump quota if this was a request
  if (quota_charged) {
    await incrementRequestUsage(admin, input.client_id)
  }

  // Activity log
  await admin.from('activity_log').insert({
    actor_id: user.id,
    entity_type: 'ticket',
    entity_id: inserted.id,
    action: 'created',
    after: { type: input.type, subject: input.subject, category: input.category, priority: input.priority },
  })

  // Notify Glip if a webhook is wired up for this department
  if (routingRes.data?.glip_webhook_url) {
    const { data: client } = await admin.from('clients').select('firm_name').eq('id', input.client_id).maybeSingle()
    try {
      await postToGlip(
        routingRes.data.glip_webhook_url,
        ticketSummary({
          number: inserted.ticket_number,
          type: input.type,
          subject: input.subject,
          client_firm: client?.firm_name ?? 'Unknown firm',
          priority: input.priority,
          url: `${process.env.NEXT_PUBLIC_APP_URL_ADMIN ?? ''}/admin/tickets/${inserted.id}`,
        })
      )
    } catch {
      // Non-fatal — ticket is already created. Log and move on.
    }
  }

  revalidatePath('/tickets')
  revalidatePath('/admin/tickets')
  return ok({ id: inserted.id, ticket_number: inserted.ticket_number })
}

export async function replyToTicket(
  ticketId: string,
  body: string,
  isInternalNote = false
): Promise<Result<{ id: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return err('UNAUTHORIZED')

  if (!body?.trim()) return err('VALIDATION_FAILED', 'Reply cannot be empty.')

  const staff = isAgencyStaff(user)
  if (isInternalNote && !staff) return err('FORBIDDEN', 'Internal notes are staff-only.')

  const admin = createAdminClient()
  const { data: msg, error } = await admin
    .from('ticket_messages')
    .insert({
      ticket_id: ticketId,
      author_id: user.id,
      body: body.trim(),
      is_internal_note: isInternalNote,
    })
    .select('id')
    .single()
  if (error || !msg) return err('INTERNAL', `Failed to post reply: ${error?.message ?? 'unknown'}`)

  // Track first response if staff is replying for the first time
  if (staff && !isInternalNote) {
    await admin
      .from('tickets')
      .update({ first_response_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', ticketId)
      .is('first_response_at', null)
  }

  revalidatePath(`/tickets/${ticketId}`)
  revalidatePath(`/admin/tickets/${ticketId}`)
  return ok({ id: msg.id })
}

export async function assignTicket(
  ticketId: string,
  assigneeUserId: string,
  departmentId?: string
): Promise<Result<{ id: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return err('UNAUTHORIZED')
  if (!isAgencyStaff(user)) return err('FORBIDDEN')

  const admin = createAdminClient()
  const updates: Record<string, unknown> = {
    assigned_user_id: assigneeUserId,
    updated_at: new Date().toISOString(),
    status: 'in_progress',
  }
  if (departmentId) updates.assigned_department_id = departmentId

  const { error } = await admin.from('tickets').update(updates).eq('id', ticketId)
  if (error) return err('INTERNAL', `Failed to assign: ${error.message}`)

  await admin.from('activity_log').insert({
    actor_id: user.id,
    entity_type: 'ticket',
    entity_id: ticketId,
    action: 'assigned',
    after: { assigned_user_id: assigneeUserId, assigned_department_id: departmentId ?? null },
  })

  revalidatePath('/admin/tickets')
  revalidatePath(`/admin/tickets/${ticketId}`)
  return ok({ id: ticketId })
}

export async function closeTicket(ticketId: string, reason?: string): Promise<Result<{ id: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return err('UNAUTHORIZED')
  if (!isAgencyStaff(user)) return err('FORBIDDEN')

  const admin = createAdminClient()
  const { error } = await admin
    .from('tickets')
    .update({
      status: 'closed',
      closed_at: new Date().toISOString(),
      closed_by: user.id,
      close_reason: reason ?? 'resolved',
      updated_at: new Date().toISOString(),
    })
    .eq('id', ticketId)
  if (error) return err('INTERNAL', `Failed to close: ${error.message}`)

  await admin.from('activity_log').insert({
    actor_id: user.id,
    entity_type: 'ticket',
    entity_id: ticketId,
    action: 'closed',
    after: { close_reason: reason ?? 'resolved' },
  })

  revalidatePath('/admin/tickets')
  revalidatePath(`/admin/tickets/${ticketId}`)
  revalidatePath('/tickets')
  return ok({ id: ticketId })
}

export async function escalateTicket(ticketId: string): Promise<Result<{ id: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return err('UNAUTHORIZED')
  if (!isAgencyStaff(user)) return err('FORBIDDEN')

  const admin = createAdminClient()
  const { error } = await admin
    .from('tickets')
    .update({
      escalated_at: new Date().toISOString(),
      escalated_by: user.id,
      priority: 'urgent',
      updated_at: new Date().toISOString(),
    })
    .eq('id', ticketId)
  if (error) return err('INTERNAL', `Failed to escalate: ${error.message}`)

  // Notify alerts channel + super admins
  const alertWebhook = process.env.RC_WEBHOOK_ALERTS
  if (alertWebhook) {
    try {
      const { data: ticket } = await admin
        .from('tickets')
        .select('ticket_number, subject, client:clients(firm_name)')
        .eq('id', ticketId)
        .maybeSingle()
      if (ticket) {
        const t = ticket as unknown as { ticket_number: number; subject: string; client: { firm_name: string } | null }
        await postToGlip(alertWebhook, {
          text: `🚨 Ticket #${t.ticket_number} ESCALATED — ${t.client?.firm_name ?? 'unknown'}: "${t.subject}"`,
          activity: 'Ticket escalated',
        })
      }
    } catch {
      // Non-fatal
    }
  }

  await admin.from('activity_log').insert({
    actor_id: user.id,
    entity_type: 'ticket',
    entity_id: ticketId,
    action: 'escalated',
  })

  revalidatePath(`/admin/tickets/${ticketId}`)
  return ok({ id: ticketId })
}

export async function reopenTicket(ticketId: string): Promise<Result<{ id: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return err('UNAUTHORIZED')

  const admin = createAdminClient()
  // Only allow reopen if the ticket was auto-closed for inactivity AND the
  // user has client membership.
  const { data: ticket } = await admin
    .from('tickets')
    .select('id, client_id, close_reason, status')
    .eq('id', ticketId)
    .maybeSingle()
  if (!ticket) return err('NOT_FOUND')

  const staff = isAgencyStaff(user)
  if (!staff) {
    if (ticket.close_reason !== 'inactivity') {
      return err('FORBIDDEN', 'This ticket was closed by staff and cannot be reopened. File a new one.')
    }
    const { data: membership } = await admin
      .from('client_users')
      .select('client_id')
      .eq('user_id', user.id)
      .eq('client_id', ticket.client_id)
      .maybeSingle()
    if (!membership) return err('FORBIDDEN')
  }

  const { error } = await admin
    .from('tickets')
    .update({
      status: 'open',
      closed_at: null,
      close_reason: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', ticketId)
  if (error) return err('INTERNAL', `Failed to reopen: ${error.message}`)

  await admin.from('activity_log').insert({
    actor_id: user.id,
    entity_type: 'ticket',
    entity_id: ticketId,
    action: 'reopened',
  })

  revalidatePath(`/tickets/${ticketId}`)
  revalidatePath(`/admin/tickets/${ticketId}`)
  return ok({ id: ticketId })
}
