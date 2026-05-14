import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { PrimkaRow, OtpremaRow, ZalihaOdjel } from '../lib/types'
import { fetchCsv, parsePrimkaRows, parseOtpremaRows, parseZalihaOdjeli, PRIMKA_URL, OTPREMA_URL, ZALIHA_URL } from '../lib/csv'

interface SheetContextValue {
  primkaRows: PrimkaRow[]
  otpremaRows: OtpremaRow[]
  zalihaOdjeli: ZalihaOdjel[]
  loading: boolean
  error: string | null
  lastUpdated: Date | null
  refetch: () => void
}

const SheetContext = createContext<SheetContextValue | null>(null)

export function SheetProvider({ children }: { children: React.ReactNode }) {
  const [primkaRows, setPrimkaRows] = useState<PrimkaRow[]>([])
  const [otpremaRows, setOtpremaRows] = useState<OtpremaRow[]>([])
  const [zalihaOdjeli, setZalihaOdjeli] = useState<ZalihaOdjel[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [primkaCsv, otpremaCsv, zalihaCsv] = await Promise.all([
        fetchCsv(PRIMKA_URL),
        fetchCsv(OTPREMA_URL),
        fetchCsv(ZALIHA_URL),
      ])
      setPrimkaRows(parsePrimkaRows(primkaCsv))
      setOtpremaRows(parseOtpremaRows(otpremaCsv))
      setZalihaOdjeli(parseZalihaOdjeli(zalihaCsv))
      setLastUpdated(new Date())
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (
        message.toLowerCase().includes('cors') ||
        message.toLowerCase().includes('failed to fetch') ||
        message.toLowerCase().includes('networkerror')
      ) {
        setError(
          'Ne može se dohvatiti podatke iz Google Sheeta. ' +
          'Provjerite da li je tabela dijeljenja postavljena na "Svi sa linkom mogu vidjeti". ' +
          'Otvorite Google Sheet → Dijeli → Promijenite na "Svi na internetu sa linkom mogu vidjeti".'
        )
      } else {
        setError(`Greška pri učitavanju podataka: ${message}`)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  return (
    <SheetContext.Provider value={{ primkaRows, otpremaRows, zalihaOdjeli, loading, error, lastUpdated, refetch: loadData }}>
      {children}
    </SheetContext.Provider>
  )
}

export function useSheet(): SheetContextValue {
  const ctx = useContext(SheetContext)
  if (!ctx) throw new Error('useSheet must be used within SheetProvider')
  return ctx
}
