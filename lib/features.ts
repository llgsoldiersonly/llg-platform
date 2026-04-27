import { createAdminClient } from './supabase/admin'

type FeatureContext = {
  userId?: string
  clientId?: string
}

export async function hasFeature(
  flagCode: string,
  context: FeatureContext = {}
): Promise<boolean> {
  const supa = createAdminClient()
  const { data: flag, error } = await supa
    .from('feature_flags')
    .select('enabled_globally, enabled_for_user_ids, enabled_for_client_ids')
    .eq('flag_code', flagCode)
    .maybeSingle()

  if (error || !flag) return false
  if (flag.enabled_globally) return true
  if (context.userId && flag.enabled_for_user_ids?.includes(context.userId)) return true
  if (context.clientId && flag.enabled_for_client_ids?.includes(context.clientId)) return true
  return false
}
