/*
 * One-off: directly create a super_admin user, bypass email send, and print
 * a magic-link URL the user can paste into their browser.
 *
 * Day-to-day, Supabase Auth delivers magic links via Resend (sender
 * `spaceman@llgportal.com`). Use this script only when you need to bypass
 * email entirely — e.g. seeding an account before DNS propagates, or
 * troubleshooting a mailbox issue. Forward the printed URL to the inbox
 * owner over a secure channel — they click once and they're in.
 *
 * Usage:
 *   pnpm tsx --env-file=.env.local scripts/grant-super-admin.ts <email> "<full_name>"
 */
import { createClient } from '@supabase/supabase-js'

async function main() {
  const email = process.argv[2]
  const fullName = process.argv[3] ?? email

  if (!email || !email.includes('@')) {
    console.error('Usage: tsx scripts/grant-super-admin.ts <email> "<full_name>"')
    process.exit(1)
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env')
    process.exit(1)
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

  // Step 1: ensure auth user exists (email_confirm: true so they don't need
  // to click a confirmation link).
  let userId: string | null = null
  const { data: lookup } = await admin
    .from('profiles')
    .select('id')
    .eq('id', '00000000-0000-0000-0000-000000000000') // placeholder; we'll re-query by email below
    .maybeSingle()
  void lookup

  // Try to find an existing auth user via the admin API
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const existing = list?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase())

  if (existing) {
    userId = existing.id
    console.log(`Found existing auth user ${userId}`)
  } else {
    console.log(`Creating auth user for ${email}…`)
    const { data: createRes, error: createErr } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    })
    if (createErr || !createRes.user) {
      console.error(`Create failed: ${createErr?.message ?? 'no user returned'}`)
      process.exit(1)
    }
    userId = createRes.user.id
    console.log(`Created ${userId}`)
  }

  // Step 2: set role to super_admin
  const { error: roleErr } = await admin.auth.admin.updateUserById(userId!, {
    app_metadata: { role: 'super_admin' },
  })
  if (roleErr) {
    console.error(`Role assignment failed: ${roleErr.message}`)
    process.exit(1)
  }
  console.log('app_metadata.role = super_admin')

  // Step 3: patch profile
  const { error: profileErr } = await admin
    .from('profiles')
    .update({ role: 'super_admin', full_name: fullName })
    .eq('id', userId!)
  if (profileErr) {
    console.error(`Profile patch failed: ${profileErr.message}`)
    process.exit(1)
  }
  console.log('profiles.role = super_admin')

  // Step 4: generate a magic-link URL (does NOT send email; just returns the URL)
  const { data: linkRes, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  })
  if (linkErr || !linkRes?.properties?.action_link) {
    console.error(`Magic link generation failed: ${linkErr?.message ?? 'no link returned'}`)
    process.exit(1)
  }

  console.log('\n=== Magic link (single-use, expires in 1 hour) ===')
  console.log(linkRes.properties.action_link)
  console.log('===================================================')
  console.log('\nForward this URL to whoever has access to ' + email + '.')
  console.log('Clicking it signs them in as super_admin — no email needed.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
