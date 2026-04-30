/**
 * Idempotent seed for the Acme Legal Test demo client. Run after a hard-delete
 * to put Acme back, or just to confirm the demo path still works end-to-end.
 *
 * Usage:  pnpm seed:demo
 *
 * What it does:
 *   - Inserts the Acme client row (firm_name unique constraint guards re-runs)
 *   - Inserts the LA HQ (Demo) location
 *   - Inserts the TITAN subscription (the on_subscriptions_insert trigger
 *     auto-generates client_onboarding_tasks)
 *
 * Verifies that is_demo_only=true so the existing crons (which all filter
 * .eq('is_demo_only', false)) skip Acme.
 */

import { createClient } from '@supabase/supabase-js'

const ACME = {
  firm_name: 'Acme Legal Test',
  primary_domain: 'acme-legal-demo.example.com',
  primary_contact_email: 'demo@lucrativelegal.com',
  primary_contact_name: 'Acme Demo',
  vertical: 'Personal Injury',
  status: 'active' as const,
  is_demo_only: true,
}
const LOCATION_LABEL = 'LA HQ (Demo)'
const PACKAGE_CODE = 'TITAN'

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.')
    process.exit(1)
  }

  const admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  console.log('1/4  Upserting Acme client row...')
  const { data: client, error: clientErr } = await admin
    .from('clients')
    .upsert(
      {
        ...ACME,
        onboarded_at: new Date().toISOString().slice(0, 10),
      },
      { onConflict: 'firm_name' }
    )
    .select('id, firm_name, is_demo_only')
    .single()
  if (clientErr || !client) throw new Error(`client upsert failed: ${clientErr?.message}`)
  if (!client.is_demo_only) {
    throw new Error(`Sanity check failed: Acme is_demo_only must be true so crons skip it.`)
  }
  console.log(`     ok  client_id=${client.id}`)

  console.log('2/4  Upserting Acme location...')
  const { data: location, error: locationErr } = await admin
    .from('client_locations')
    .upsert(
      {
        client_id: client.id,
        label: LOCATION_LABEL,
        city: 'Los Angeles',
        state: 'CA',
        is_primary: true,
      },
      { onConflict: 'client_id,label' }
    )
    .select('id, label')
    .single()
  if (locationErr || !location) throw new Error(`location upsert failed: ${locationErr?.message}`)
  console.log(`     ok  location_id=${location.id}`)

  console.log('3/4  Looking up TITAN package...')
  const { data: pkg, error: pkgErr } = await admin
    .from('package_templates')
    .select('id, code')
    .eq('code', PACKAGE_CODE)
    .single()
  if (pkgErr || !pkg) throw new Error(`TITAN package not seeded: ${pkgErr?.message}`)

  console.log('4/4  Ensuring TITAN subscription exists...')
  // No native upsert — subscriptions has no unique constraint we can target.
  // Check-then-insert keeps it idempotent. The on-insert trigger from
  // migration 0013 auto-generates client_onboarding_tasks.
  const { data: existing } = await admin
    .from('subscriptions')
    .select('id')
    .eq('client_id', client.id)
    .eq('package_id', pkg.id)
    .eq('location_id', location.id)
    .maybeSingle()

  if (existing) {
    console.log(`     ok  subscription_id=${existing.id} (already existed, no insert)`)
  } else {
    const { data: sub, error: subErr } = await admin
      .from('subscriptions')
      .insert({
        client_id: client.id,
        package_id: pkg.id,
        location_id: location.id,
        status: 'active',
        started_at: new Date().toISOString().slice(0, 10),
      })
      .select('id')
      .single()
    if (subErr || !sub) throw new Error(`subscription insert failed: ${subErr?.message}`)
    console.log(`     ok  subscription_id=${sub.id} (new)`)

    const { count } = await admin
      .from('client_onboarding_tasks')
      .select('*', { count: 'exact', head: true })
      .eq('subscription_id', sub.id)
    console.log(`     trigger generated ${count ?? 0} onboarding task(s)`)
  }

  console.log('\nDone. Acme is seeded with is_demo_only=true; nightly crons will skip it.')
}

main().catch((err) => {
  console.error('\nFAILED:', err.message)
  process.exit(1)
})
