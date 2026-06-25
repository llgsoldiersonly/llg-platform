import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Download, Inbox } from 'lucide-react'

export type PortalLeadFile = {
  id: string
  file_name: string
  created_at: string
}

// Client-facing Leads box. Renders above Monthly production when the client has
// leads enabled. Each PDF downloads via the access-checked /api/leads route.
export function LeadsCard({ files }: { files: PortalLeadFile[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Your Leads</CardTitle>
      </CardHeader>
      <CardContent>
        {files.length === 0 ? (
          <div className="flex items-center gap-3 text-sm text-body">
            <Inbox className="h-5 w-5 text-body-subtle" />
            No leads delivered yet — new lead files will appear here as they&apos;re uploaded.
          </div>
        ) : (
          <ul className="divide-y divide-border-light">
            {files.map((f) => (
              <li key={f.id} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-heading">{f.file_name}</p>
                  <p className="text-xs text-body-subtle">
                    Uploaded {new Date(f.created_at).toLocaleString()}
                  </p>
                </div>
                <a
                  href={`/api/leads/${f.id}/download`}
                  className="inline-flex items-center gap-1.5 rounded-pill border border-border-default px-3 py-1.5 text-sm font-medium text-heading transition-colors hover:bg-neutral-secondary-soft"
                >
                  <Download className="h-4 w-4" />
                  Download
                </a>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
