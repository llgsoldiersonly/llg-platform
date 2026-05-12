/*
 * One-off: invite a user as super_admin.
 * Usage:
 *   pnpm tsx --env-file=.env.local scripts/invite-super-admin.ts <email> "<full_name>"
 *
 * Mirrors lib/actions/invites.ts::inviteStaff but runs from CLI (the server
 * action requires an HTTP caller who is already a super_admin).
 */
import { createClient } from '@supabase/supabase-js'

async function main() {
  const email = process.argv[2]
  const fullName = process.argv[3] ?? email

  if (!email || !email.includes('@')) {
    console.error('Usage: tsx scripts/invite-super-admin.ts <email> "<full_name>"')
    process.exit(1)
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env')
    process.exit(1)
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

  console.log(`Inviting ${email} as super_admin…`)
  const { data: inviteData, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName },
  })
  if (inviteErr || !inviteData.user) {
    console.error('Invite failed:', inviteErr?.message ?? 'no user returned')
    process.exit(1)
  }
  const userId = inviteData.user.id
  console.log(`Auth user created: ${userId}`)

  const { error: roleErr } = await admin.auth.admin.updateUserById(userId, {
    app_metadata: { role: 'super_admin' },
  })
  if (roleErr) {
    console.error(`Role assignment failed: ${roleErr.message}. User ${userId} needs manual fix.`)
    process.exit(1)
  }
  console.log('app_metadata.role = super_admin')

  const { error: profileErr } = await admin
    .from('profiles')
    .update({ role: 'super_admin', full_name: fullName })
    .eq('id', userId)
  if (profileErr) {
    console.error(`Profile patch failed: ${profileErr.message}. User ${userId} needs manual fix.`)
    process.exit(1)
  }
  console.log('profiles.role = super_admin, full_name updated')

  console.log(`\nInvite email sent to ${email}. They'll click the magic link to set up their account.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
