import JSZip from 'jszip'
import type { SupabaseClient } from '@supabase/supabase-js'
import { rowsToCsv } from '@/lib/csv'

const BUCKET = 'client-archives'
const SIGNED_URL_TTL_SECONDS = 30 * 24 * 3_600 // 30 days

export type ArchiveData = Record<string, unknown> & {
  clients: Record<string, unknown>
}

/**
 * Composes a ZIP from a hard-delete archive snapshot and uploads it to the
 * client-archives Supabase Storage bucket. Returns the signed URL the
 * caller can surface (notification, email, in-UI download). 30-day TTL.
 *
 * Layout inside the ZIP:
 *   metadata.json       — firm name, archived_at, table-row counts
 *   clients.csv         — single-row dump of the client itself
 *   <table>.csv         — one CSV per non-empty related table
 */
export async function exportArchiveToStorage(
  admin: SupabaseClient,
  archiveId: number,
  firmName: string,
  archiveData: ArchiveData
): Promise<{ path: string; signedUrl: string | null }> {
  const zip = new JSZip()

  const counts: Record<string, number> = {}

  for (const [tableName, payload] of Object.entries(archiveData)) {
    if (tableName === 'clients') {
      // The client row is a single object, not an array.
      const row = payload as Record<string, unknown>
      zip.file('clients.csv', rowsToCsv([row]))
      counts.clients = 1
      continue
    }
    const rows = Array.isArray(payload) ? (payload as Array<Record<string, unknown>>) : []
    counts[tableName] = rows.length
    if (rows.length > 0) {
      zip.file(`${tableName}.csv`, rowsToCsv(rows))
    }
  }

  zip.file(
    'metadata.json',
    JSON.stringify(
      {
        archive_id: archiveId,
        firm_name: firmName,
        archived_at: new Date().toISOString(),
        table_row_counts: counts,
        format_version: 1,
        notes:
          'CSVs are best-effort dumps from a hard-deleted client. Time-series tables (calls, posts, rankings_daily) are scoped to the last 365 days at archive time; other tables are full dumps. Restore would need to be assembled manually from these files.',
      },
      null,
      2
    )
  )

  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
  const slug = firmName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const path = `${new Date().toISOString().slice(0, 10)}/${archiveId}-${slug || 'unnamed'}.zip`

  const { error: uploadErr } = await admin.storage
    .from(BUCKET)
    .upload(path, zipBuffer, {
      contentType: 'application/zip',
      upsert: false,
    })
  if (uploadErr) {
    throw new Error(`Storage upload failed: ${uploadErr.message}`)
  }

  const { data: signed, error: signErr } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS)
  if (signErr) {
    // Upload succeeded; only the signing failed. Return the path so caller
    // can re-sign later if needed.
    return { path, signedUrl: null }
  }

  return { path, signedUrl: signed?.signedUrl ?? null }
}
