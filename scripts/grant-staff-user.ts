/*
 * One-off: create or update a user as agency_staff, bypass email send, and
 * print a magic-link URL the user can paste into their browser.
 *
 * Why this exists: Supabase Auth's outbound email goes through Resend, and
 * Resend is in test mode (only the account-owner email receives mail) until
 * the lucrativelegal.com domain is verified at resend.com/domains. So the
 * built-in `inviteStaff` admin UI flow returns 500 for anyone except
 * nathan.u@lucrativelegal.com. This script sidesteps the email path:
 * creates the user, sets role=agency_staff, mints a one-hour magic link
 * URL. Forward the URL over a secure channel to the inbox owner.
 *
 * After Resend domain verification lands, you can stop using this script
 * and go through /admin/settings/users instead — the standard invite flow
 * will then email a real magic link.
 *
 * Usage:
 *   pnpm tsx --env-file=.env.local scripts/grant-staff-user.ts <email> "<full_name>"
 *
 * Result: agency_staff user can sign in at llgportal.com and lands on
 * /staff (the agency workspace). They can't access /admin/* or /overview.
 */
import { createClient } from '@supabase/supabase-js'

const ROLE = 'agency_staff' as const

async function main() {
  const email = process.argv[2]
  const fullName = process.argv[3] ?? email

  if (!email || !email.includes('@')) {
    console.error('Usage: tsx scripts/grant-staff-user.ts <email> "<full_name>"')
    process.exit(1)
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env')
    process.exit(1)
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

  // 1. Find or create the auth user.
  let userId: string
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const existing = list?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase())

  if (existing) {
    userId = existing.id
    console.log(`Found existing auth user ${userId} for ${email}`)
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

  // 2. Set role in app_metadata (middleware reads from here).
  const { error: roleErr } = await admin.auth.admin.updateUserById(userId, {
    app_metadata: { role: ROLE },
  })
  if (roleErr) {
    console.error(`Role assignment failed: ${roleErr.message}`)
    process.exit(1)
  }
  console.log(`app_metadata.role = ${ROLE}`)

  // 3. Patch the profile row (created by the on_auth_user_created trigger
  // with a default role; we override here).
  const { error: profileErr } = await admin
    .from('profiles')
    .update({ role: ROLE, full_name: fullName })
    .eq('id', userId)
  if (profileErr) {
    console.error(`Profile patch failed: ${profileErr.message}`)
    process.exit(1)
  }
  console.log(`profiles.role = ${ROLE}`)

  // 4. Mint a magic-link URL (no email sent — DFS-of-Supabase auth).
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
  console.log(`\nForward this URL to ${email}. Clicking signs them in as agency_staff —`)
  console.log('they land at /staff (the agency workspace) and cannot access /admin or')
  console.log('the client portal.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
