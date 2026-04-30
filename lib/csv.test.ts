import { describe, it, expect } from 'vitest'
import { rowsToCsv } from './csv'

describe('rowsToCsv', () => {
  it('returns empty string when no rows', () => {
    expect(rowsToCsv([])).toBe('')
  })

  it('serializes simple rows with header', () => {
    const out = rowsToCsv([
      { id: 1, name: 'Olson' },
      { id: 2, name: 'Movahedi' },
    ])
    expect(out).toBe('id,name\n1,Olson\n2,Movahedi')
  })

  it('quotes fields containing commas, quotes, or newlines', () => {
    const out = rowsToCsv([
      { id: 1, name: 'Smith, Jones, & Co.', notes: 'has "quotes" inside\nnew line too' },
    ])
    expect(out).toBe(
      'id,name,notes\n1,"Smith, Jones, & Co.","has ""quotes"" inside\nnew line too"'
    )
  })

  it('renders null/undefined as empty fields', () => {
    const out = rowsToCsv([{ id: 1, name: null, notes: undefined }])
    expect(out).toBe('id,name,notes\n1,,')
  })

  it('JSON-stringifies nested objects/arrays', () => {
    const out = rowsToCsv([{ id: 1, tags: ['a', 'b'], meta: { x: 1 } }])
    // Both nested values get JSON-stringified, then quoted because they contain commas/quotes
    expect(out).toBe('id,tags,meta\n1,"[""a"",""b""]","{""x"":1}"')
  })

  it('unions keys across rows so sparse columns are kept', () => {
    const out = rowsToCsv([
      { id: 1, name: 'a' },
      { id: 2, email: 'b@x.com' },
    ])
    expect(out).toBe('id,name,email\n1,a,\n2,,b@x.com')
  })
})
