import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export type TeamMember = {
  id: string
  full_name: string
  role_label: string
  avatar_color: 'purple' | 'sky' | 'amber' | 'emerald'
}

const AVATAR_BG = {
  purple: 'bg-brand-soft text-fg-brand',
  sky: 'bg-sky-100 text-sky-800',
  amber: 'bg-amber-100 text-amber-800',
  emerald: 'bg-emerald-100 text-emerald-800',
}

export function SupportTeamCard({ members }: { members: TeamMember[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Your Support Team</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {members.length === 0 ? (
          <p className="text-sm text-slate-600">
            Your account team will appear here as roles are assigned.
          </p>
        ) : (
          <>
            <div className="grid gap-2 sm:grid-cols-2">
              {members.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center gap-3 rounded-md border border-slate-100 p-3"
                >
                  <span
                    className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold ${AVATAR_BG[m.avatar_color]}`}
                  >
                    {initials(m.full_name)}
                  </span>
                  <div className="leading-tight">
                    <div className="text-xs uppercase tracking-wide text-slate-600">
                      {m.role_label}
                    </div>
                    <div className="text-sm font-medium text-slate-900">{m.full_name}</div>
                  </div>
                </div>
              ))}
            </div>
            <p className="pt-2 text-center text-xs text-slate-500">
              Reference these names in your support tickets.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?'
}
