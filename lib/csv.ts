// Tiny CSV serializer for the hard-delete export. Not a full RFC 4180 impl —
// just enough to turn an array of plain-object rows into a CSV string with
// quoted/escaped fields. Suitable for archive bundles, not for arbitrary
// user-supplied data.

function escapeField(value: unknown): string {
  if (value == null) return ''
  let str: string
  if (typeof value === 'string') str = value
  else if (typeof value === 'number' || typeof value === 'boolean') str = String(value)
  else str = JSON.stringify(value)

  if (/[",\n\r]/.test(str)) {
    str = `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export function rowsToCsv(rows: Array<Record<string, unknown>>): string {
  if (rows.length === 0) return ''
  // Union all keys across rows so sparse columns don't drop.
  const headerSet = new Set<string>()
  for (const row of rows) {
    for (const k of Object.keys(row)) headerSet.add(k)
  }
  const headers = Array.from(headerSet)
  const lines = [headers.join(',')]
  for (const row of rows) {
    lines.push(headers.map((h) => escapeField(row[h])).join(','))
  }
  return lines.join('\n')
}
