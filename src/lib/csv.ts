import { parseBosnianDate, parseNumericBosnian } from './utils'
import type { PrimkaRow, OtpremaRow } from './types'

const SHEET_ID = '1DIpllQlrMJwE9wpF1Gtwbnbh6ghYM5f1PimSK2gwVQQ'

export const PRIMKA_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=INDEKS_PRIMKA`
export const OTPREMA_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=INDEKS_OTPREMA`

/** Minimal CSV parser handling quoted fields */
export function fetchCsv(url: string): Promise<string[][]> {
  return fetch(url).then(async (res) => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const text = await res.text()
    return parseCsvText(text)
  })
}

function parseCsvText(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let i = 0
  while (i < text.length) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ }
        else inQuotes = false
      } else {
        field += ch
      }
    } else {
      if (ch === '"') { inQuotes = true }
      else if (ch === ',') { row.push(field); field = '' }
      else if (ch === '\r') { /* skip */ }
      else if (ch === '\n') { row.push(field); field = ''; rows.push(row); row = [] }
      else { field += ch }
    }
    i++
  }
  if (field || row.length > 0) { row.push(field); rows.push(row) }
  return rows.filter(r => r.some(c => c.trim() !== ''))
}

export function parsePrimkaRows(csv: string[][]): PrimkaRow[] {
  return csv.slice(1).map(row => {
    if (!row[0]?.trim()) return null
    const datum = parseBosnianDate(row[0])
    if (!datum) return null
    const n = (i: number) => parseNumericBosnian(row[i])
    return {
      datum,
      primac: (row[1] ?? '').trim(),
      odjel: (row[2] ?? '').trim(),
      radiliste: (row[3] ?? '').trim(),
      izvođač: (row[4] ?? '').trim(),
      poslovoda: (row[5] ?? '').trim(),
      fl_c: n(6), i_c: n(7), ii_c: n(8), iii_c: n(9), rd_c: n(10),
      trupci_c: n(11), cel_duga: n(12), cel_cijepana: n(13), skart: n(14), sigma_cetinari: n(15),
      fl_l: n(16), i_l: n(17), ii_l: n(18), iii_l: n(19), trupci_l: n(20),
      ogr_dugi: n(21), ogr_cijepani: n(22), gule: n(23), liscare: n(24), ukupno: n(25),
    } satisfies PrimkaRow
  }).filter((r): r is PrimkaRow => r !== null)
}

export function parseOtpremaRows(csv: string[][]): OtpremaRow[] {
  return csv.slice(1).map(row => {
    if (!row[0]?.trim()) return null
    const datum = parseBosnianDate(row[0])
    if (!datum) return null
    const n = (i: number) => parseNumericBosnian(row[i])
    return {
      datum,
      otpremac: (row[1] ?? '').trim(),
      kupac: (row[2] ?? '').trim(),
      odjel: (row[3] ?? '').trim(),
      radiliste: (row[4] ?? '').trim(),
      izvođač: (row[5] ?? '').trim(),
      poslovoda: (row[6] ?? '').trim(),
      fl_c: n(7), i_c: n(8), ii_c: n(9), iii_c: n(10), rd_c: n(11),
      trupci_c: n(12), cel_duga: n(13), cel_cijepana: n(14), skart: n(15), sigma_cetinari: n(16),
      fl_l: n(17), i_l: n(18), ii_l: n(19), iii_l: n(20), trupci_l: n(21),
      ogr_dugi: n(22), ogr_cijepani: n(23), gule: n(24), liscare: n(25), ukupno: n(26),
    } satisfies OtpremaRow
  }).filter((r): r is OtpremaRow => r !== null)
}
