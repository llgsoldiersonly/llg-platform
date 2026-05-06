'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAgencyStaff } from '@/lib/auth/rbac'
import { ok, err, type Result } from '@/lib/errors'
import {
  expandKeywordTemplates,
  type PracticeArea,
} from '@/lib/seo/keywordTemplates'

// =====================================================================
// TRACKED KEYWORDS
// =====================================================================

export type TrackedKeywordInput = {
  client_id: string
  client_location_id?: string | null
  keyword: string
  practice_area?: string | null
  city?: string | null
  state?: string | null
  zip_code?: string | null
  location_name?: string | null
  location_code?: number | null
  language_code?: string
  device?: 'desktop' | 'mobile'
  search_type: 'organic' | 'local_pack' | 'maps' | 'ai_mode'
  priority?: 'low' | 'medium' | 'high'
}

export async function addTrackedKeyword(
  input: TrackedKeywordInput
): Promise<Result<{ id: string }>> {
  const guard = await guardStaff()
  if (!guard.ok) return guard

  if (!input.keyword.trim()) {
    return err('VALIDATION_FAILED', 'keyword is required')
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('dfs_tracked_keywords')
    .insert({
      client_id: input.client_id,
      client_location_id: input.client_location_id ?? null,
      keyword: input.keyword.trim().toLowerCase(),
      practice_area: input.practice_area ?? null,
      city: input.city ?? null,
      state: input.state ?? null,
      zip_code: input.zip_code ?? null,
      location_name: input.location_name ?? null,
      location_code: input.location_code ?? null,
      language_code: input.language_code ?? 'en',
      device: input.device ?? 'desktop',
      search_type: input.search_type,
      priority: input.priority ?? 'medium',
      is_active: true,
    })
    .select('id')
    .single()

  if (error) return err('INTERNAL', `Failed to add keyword: ${error.message}`, error)
  revalidatePath(`/admin/clients/${input.client_id}/seo`)
  return ok({ id: data.id })
}

export async function bulkAddKeywordTemplates(input: {
  client_id: string
  client_location_id?: string | null
  practice_area: PracticeArea
  city: string
  state?: string | null
  search_type: 'organic' | 'local_pack' | 'maps'
  priority?: 'low' | 'medium' | 'high'
}): Promise<Result<{ inserted: number }>> {
  const guard = await guardStaff()
  if (!guard.ok) return guard

  const keywords = expandKeywordTemplates(input.practice_area, input.city)
  if (keywords.length === 0) {
    return err('VALIDATION_FAILED', 'no templates available for that practice area')
  }

  const rows = keywords.map((k) => ({
    client_id: input.client_id,
    client_location_id: input.client_location_id ?? null,
    keyword: k.toLowerCase(),
    practice_area: input.practice_area,
    city: input.city,
    state: input.state ?? null,
    location_name: input.city && input.state ? `${input.city},${input.state},United States` : null,
    language_code: 'en',
    device: 'desktop' as const,
    search_type: input.search_type,
    priority: input.priority ?? 'medium',
    is_active: true,
  }))

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('dfs_tracked_keywords')
    .insert(rows)
    .select('id')

  if (error) return err('INTERNAL', `Failed bulk insert: ${error.message}`, error)
  revalidatePath(`/admin/clients/${input.client_id}/seo`)
  return ok({ inserted: data.length })
}

export async function toggleTrackedKeyword(
  client_id: string,
  keyword_id: string,
  is_active: boolean
): Promise<Result<null>> {
  const guard = await guardStaff()
  if (!guard.ok) return guard

  const admin = createAdminClient()
  const { error } = await admin
    .from('dfs_tracked_keywords')
    .update({ is_active })
    .eq('id', keyword_id)
    .eq('client_id', client_id)

  if (error) return err('INTERNAL', `Failed to toggle keyword: ${error.message}`, error)
  revalidatePath(`/admin/clients/${client_id}/seo`)
  return ok(null)
}

export async function removeTrackedKeyword(
  client_id: string,
  keyword_id: string
): Promise<Result<null>> {
  const guard = await guardStaff()
  if (!guard.ok) return guard

  const admin = createAdminClient()
  const { error } = await admin
    .from('dfs_tracked_keywords')
    .delete()
    .eq('id', keyword_id)
    .eq('client_id', client_id)

  if (error) return err('INTERNAL', `Failed to remove keyword: ${error.message}`, error)
  revalidatePath(`/admin/clients/${client_id}/seo`)
  return ok(null)
}

// =====================================================================
// COMPETITOR SITES
// =====================================================================

export type CompetitorInput = {
  client_id: string
  competitor_name: string
  competitor_domain?: string | null
  google_business_profile_name?: string | null
  city?: string | null
  state?: string | null
  notes?: string | null
}

export async function addCompetitor(input: CompetitorInput): Promise<Result<{ id: string }>> {
  const guard = await guardStaff()
  if (!guard.ok) return guard

  if (!input.competitor_name.trim()) {
    return err('VALIDATION_FAILED', 'competitor_name is required')
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('dfs_competitor_sites')
    .insert({
      client_id: input.client_id,
      competitor_name: input.competitor_name.trim(),
      competitor_domain: input.competitor_domain ?? null,
      google_business_profile_name: input.google_business_profile_name ?? null,
      city: input.city ?? null,
      state: input.state ?? null,
      notes: input.notes ?? null,
      is_active: true,
    })
    .select('id')
    .single()

  if (error) return err('INTERNAL', `Failed to add competitor: ${error.message}`, error)
  revalidatePath(`/admin/clients/${input.client_id}/seo`)
  return ok({ id: data.id })
}

export async function removeCompetitor(
  client_id: string,
  competitor_id: string
): Promise<Result<null>> {
  const guard = await guardStaff()
  if (!guard.ok) return guard

  const admin = createAdminClient()
  const { error } = await admin
    .from('dfs_competitor_sites')
    .delete()
    .eq('id', competitor_id)
    .eq('client_id', client_id)

  if (error) return err('INTERNAL', `Failed to remove competitor: ${error.message}`, error)
  revalidatePath(`/admin/clients/${client_id}/seo`)
  return ok(null)
}

// =====================================================================
// MAP GRID POINTS
// =====================================================================

export type MapGridInput = {
  client_id: string // for revalidation
  client_location_id: string
  label?: string | null
  lat: number
  lng: number
  radius_miles?: number
}

export async function addMapGridPoint(
  input: MapGridInput
): Promise<Result<{ id: string }>> {
  const guard = await guardStaff()
  if (!guard.ok) return guard

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('dfs_map_grid_points')
    .insert({
      client_location_id: input.client_location_id,
      label: input.label ?? null,
      lat: input.lat,
      lng: input.lng,
      radius_miles: input.radius_miles ?? 5,
    })
    .select('id')
    .single()

  if (error) return err('INTERNAL', `Failed to add grid point: ${error.message}`, error)
  revalidatePath(`/admin/clients/${input.client_id}/seo`)
  return ok({ id: data.id })
}

// Generates a square grid (3x3 / 5x5 / 7x7) centered on the given lat/lng.
// stepMiles is the distance between adjacent rows/columns (default 1mi).
export async function seedSquareMapGrid(input: {
  client_id: string
  client_location_id: string
  centerLat: number
  centerLng: number
  size: 3 | 5 | 7
  stepMiles?: number
}): Promise<Result<{ inserted: number }>> {
  const guard = await guardStaff()
  if (!guard.ok) return guard

  const step = input.stepMiles ?? 1
  // 1° latitude ≈ 69 miles; 1° longitude ≈ 69 * cos(lat) miles.
  const dLat = step / 69
  const dLng = step / (69 * Math.cos((input.centerLat * Math.PI) / 180))

  const half = Math.floor(input.size / 2)
  const rows: Array<{
    client_location_id: string
    label: string
    lat: number
    lng: number
    radius_miles: number
  }> = []

  for (let r = -half; r <= half; r++) {
    for (let c = -half; c <= half; c++) {
      rows.push({
        client_location_id: input.client_location_id,
        label: `${r},${c}`,
        lat: input.centerLat + r * dLat,
        lng: input.centerLng + c * dLng,
        radius_miles: step,
      })
    }
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('dfs_map_grid_points')
    .insert(rows)
    .select('id')

  if (error) return err('INTERNAL', `Failed to seed grid: ${error.message}`, error)
  revalidatePath(`/admin/clients/${input.client_id}/seo`)
  return ok({ inserted: data.length })
}

export async function removeMapGridPoint(
  client_id: string,
  point_id: string
): Promise<Result<null>> {
  const guard = await guardStaff()
  if (!guard.ok) return guard

  const admin = createAdminClient()
  const { error } = await admin.from('dfs_map_grid_points').delete().eq('id', point_id)

  if (error) return err('INTERNAL', `Failed to remove grid point: ${error.message}`, error)
  revalidatePath(`/admin/clients/${client_id}/seo`)
  return ok(null)
}

// ---------------------------------------------------------------
async function guardStaff(): Promise<Result<null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return err('UNAUTHORIZED')
  if (!isAgencyStaff(user)) return err('FORBIDDEN')
  return ok(null)
}
