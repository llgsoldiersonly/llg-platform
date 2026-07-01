import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { isAgencyStaff } from '@/lib/auth/rbac'
import { Button } from '@/components/ui/button'
import { LlgWordmark } from '@/components/brand/logo'
import { signOutAction } from '@/lib/actions/auth'

// The agency-staff portal. Hard-gated to users with role='agency_staff' or
// 'super_admin'. Client users get redirected away by middleware; this
// layout's redirect is defense in depth.
//
// Intentionally minimal — staff only needs to submit completed work.
// No client widgets, no admin tools, no firm-overview navigation. If
// they need to see how clients see things, super_admin uses impersonation.
export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/staff')
  if (!isAgencyStaff(user)) redirect('/login?error=forbidden')

  return (
    <div className="min-h-screen bg-neutral-secondary-soft">
      <header className="border-b border-border-default bg-neutral-primary-soft">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-6 px-6 py-4">
          <Link href="/staff" className="flex items-center gap-3">
            <LlgWordmark size="md" />
            <span className="hidden text-[10px] uppercase tracking-wider text-fg-brand-strong md:inline">
              Agency Workspace
            </span>
          </Link>
          <nav className="flex items-center gap-6">
            <Link
              href="/staff"
              className="text-sm font-medium text-body hover:text-heading"
            >
              Submit Work
            </Link>
            <Link
              href="/staff/board"
              className="text-sm font-medium text-body hover:text-heading"
            >
              My Work
            </Link>
            <Link
              href="/staff/recent"
              className="text-sm font-medium text-body hover:text-heading"
            >
              My Recent
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-body md:inline">
              {user.email}
            </span>
            <form action={signOutAction}>
              <Button type="submit" variant="outline" size="sm">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  )
}
