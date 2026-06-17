'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAgencyStaff } from '@/lib/auth/rbac'
import { ok, err, type Result } from '@/lib/errors'
import { getCitationTrackerResults, submitCitationReport } from '@/lib/integrations/brightlocal'

type CitationRefresh = { status: 'requested' | 'pending' | 'updated'; message: string }

// On-demand BrightLocal Citation Tracker pull for one client (staff/admin).
// Citations are stored per-client (one row/day); we anchor to the client's
// primary location for the NAP + the report id. If no report exists yet we
// request one (BrightLocal crawls async — results land on a later pull); if a
// report exists we fetch its results and upsert into citations + raw_citations.
export async function refreshClientCitations(clientId: string): Promise<Result<CitationRefresh>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return err('UNAUTHORIZED')
  if (!isAgencyStaff(user)) return err('FORBIDDEN', 'Only staff can refresh citations')
  if (!clientId) return err('VALIDATION_FAILED', 'Missing client id')

  const apiKey = process.env.BRIGHTLOCAL_API_KEY
  if (!apiKey) return err('INTEGRATION_FAILED', 'BRIGHTLOCAL_API_KEY is not configured in the environment')

  const admin = createAdminClient()
  const { data: client } = await admin
    .from('clients')
    .select('id, firm_name, primary_domain, primary_contact_phone')
    .eq('id', clientId)
    .maybeSingle()
  if (!client) return err('NOT_FOUND', 'Client not found')

  const { data: loc } = await admin
    .from('client_locations')
    .select('id, city, state, full_address, country, brightlocal_citation_report_id')
    .eq('client_id', clientId)
    .order('is_primary', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!loc) return err('VALIDATION_FAILED', 'Client has no location to anchor citations')

  // No report yet → request one. BrightLocal crawls asynchronously, so results
  // won't be ready immediately; the report id is saved so the next pull fetches.
  if (!loc.brightlocal_citation_report_id) {
    try {
      const reportId = await submitCitationReport(apiKey, {
        business_name: client.firm_name,
        address: loc.full_address ?? '',
        city: loc.city,
        state: loc.state,
        country: loc.country && loc.country !== 'US' ? loc.country : 'USA',
        website: client.primary_domain ?? undefined,
        phone: client.primary_contact_phone ?? undefined,
      })
      await admin
        .from('client_locations')
        .update({ brightlocal_citation_report_id: reportId })
        .eq('id', loc.id)
      return ok({
        status: 'requested',
        message: `Citation report requested from BrightLocal (id ${reportId}). It takes a while to crawl — click again shortly to pull the results.`,
      })
    } catch (e) {
      return err('INTEGRATION_FAILED', e instanceof Error ? e.message : 'BrightLocal request failed')
    }
  }

  // Report exists → fetch results and store.
  try {
    const result = await getCitationTrackerResults(apiKey, loc.brightlocal_citation_report_id)
    if (!result) {
      return ok({ status: 'pending', message: 'BrightLocal report is still processing — try again shortly.' })
    }
    const today = new Date().toISOString().slice(0, 10)
    await admin.from('citations').upsert(
      {
        client_id: clientId,
        health_score: result.health_score,
        correct_count: result.correct_count,
        incorrect_count: result.incorrect_count,
        missing_count: result.missing_count,
        captured_on: today,
      },
      { onConflict: 'client_id,captured_on' }
    )
    await admin.from('raw_citations').insert({
      client_id: clientId,
      health_score: result.health_score,
      correct_count: result.correct_count,
      incorrect_count: result.incorrect_count,
      missing_count: result.missing_count,
      directories: result.directories ?? null,
      ai_fixes: result.ai_fixes ?? null,
    })
    revalidatePath(`/admin/clients/${clientId}/local`)
    return ok({
      status: 'updated',
      message: `Citations updated — health ${result.health_score ?? '—'} (${result.correct_count ?? 0} correct / ${result.incorrect_count ?? 0} incorrect / ${result.missing_count ?? 0} missing).`,
    })
  } catch (e) {
    return err('INTEGRATION_FAILED', e instanceof Error ? e.message : 'BrightLocal fetch failed')
  }
}
