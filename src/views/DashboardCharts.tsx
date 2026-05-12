import { useEffect, useMemo, useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import type { Patient } from '../models/types'
import { db } from '../services/database'
import { BRAZIL_STATES } from '../data/brazilStates'
import BrazilMap from './BrazilMap'
import styles from './DashboardCharts.module.css'

interface Props {
  patients: Patient[]
}

interface DailyAvg {
  date: string
  label: string
  systolic: number
  diastolic: number
  hr: number
  count: number
}

interface DailyGlucose {
  date: string
  label: string
  avg: number
  count: number
}

// Estados brasileiros fictícios para o mapa enquanto o cadastro de endereço
// não está em produção. Distribuição determinística por id do paciente.
const STATE_SIGLAS = BRAZIL_STATES.map((s) => s.sigla)

function stateFor(patientId: string): string {
  let hash = 0
  for (let i = 0; i < patientId.length; i++) {
    hash = (hash * 31 + patientId.charCodeAt(i)) >>> 0
  }
  return STATE_SIGLAS[hash % STATE_SIGLAS.length]
}

function stateName(sigla: string): string {
  return BRAZIL_STATES.find((s) => s.sigla === sigla)?.name ?? sigla
}

export default function DashboardCharts({ patients }: Props) {
  const [search, setSearch] = useState('')
  const [stateFilter, setStateFilter] = useState<string>('all')
  const [series, setSeries] = useState<DailyAvg[]>([])
  const [glucoseSeries, setGlucoseSeries] = useState<DailyGlucose[]>([])
  const [loading, setLoading] = useState(true)

  const filteredPatients = useMemo(() => {
    const q = search.trim().toLowerCase()
    return patients.filter((p) => {
      if (stateFilter !== 'all' && stateFor(p.id) !== stateFilter) return false
      if (!q) return true
      return (
        p.name.toLowerCase().includes(q) ||
        (p.phone || '').toLowerCase().includes(q) ||
        (p.comorbidities || []).some((c) => c.toLowerCase().includes(q))
      )
    })
  }, [patients, search, stateFilter])

  const stateCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const p of patients) {
      const s = stateFor(p.id)
      counts[s] = (counts[s] ?? 0) + 1
    }
    return counts
  }, [patients])

  const sortedStateEntries = useMemo(
    () =>
      Object.entries(stateCounts).sort((a, b) => b[1] - a[1]),
    [stateCounts]
  )

  useEffect(() => {
    async function load() {
      setLoading(true)
      const ids = new Set(filteredPatients.map((p) => p.id))
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - 6)

      const [allMeas, allGlc] = await Promise.all([
        db.measurements.toArray(),
        db.glucoseMeasurements.toArray(),
      ])
      const recent = allMeas.filter((m) => ids.has(m.patientId) && new Date(m.measuredAt) >= cutoff)
      const recentGlc = allGlc.filter((g) => ids.has(g.patientId) && new Date(g.measuredAt) >= cutoff)

      const dayKeys: string[] = []
      const byDay = new Map<string, { sys: number[]; dia: number[]; hr: number[] }>()
      const byDayGlc = new Map<string, number[]>()
      for (let i = 6; i >= 0; i--) {
        const d = new Date()
        d.setDate(d.getDate() - i)
        const key = d.toISOString().slice(0, 10)
        dayKeys.push(key)
        byDay.set(key, { sys: [], dia: [], hr: [] })
        byDayGlc.set(key, [])
      }
      for (const m of recent) {
        const key = new Date(m.measuredAt).toISOString().slice(0, 10)
        const bucket = byDay.get(key)
        if (!bucket) continue
        bucket.sys.push(m.systolic)
        bucket.dia.push(m.diastolic)
        if (m.heartRate) bucket.hr.push(m.heartRate)
      }
      for (const g of recentGlc) {
        const key = new Date(g.measuredAt).toISOString().slice(0, 10)
        const arr = byDayGlc.get(key)
        if (arr) arr.push(g.value)
      }
      const avg = (xs: number[]) =>
        xs.length ? Math.round(xs.reduce((a, c) => a + c, 0) / xs.length) : 0
      const out: DailyAvg[] = dayKeys.map((key) => {
        const b = byDay.get(key)!
        const d = new Date(key)
        return {
          date: key,
          label: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
          systolic: avg(b.sys),
          diastolic: avg(b.dia),
          hr: avg(b.hr),
          count: b.sys.length,
        }
      })
      const outGlc: DailyGlucose[] = dayKeys.map((key) => {
        const arr = byDayGlc.get(key)!
        const d = new Date(key)
        return {
          date: key,
          label: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
          avg: avg(arr),
          count: arr.length,
        }
      })
      setSeries(out)
      setGlucoseSeries(outGlc)
      setLoading(false)
    }
    load()
  }, [filteredPatients])

  return (
    <section className={styles.wrapper}>
      <div className={styles.toolbar}>
        <div className={styles.searchWrap}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.5" y2="16.5" />
          </svg>
          <input
            className={styles.searchInput}
            placeholder="Buscar paciente, telefone, comorbidade…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select
          className={styles.regionSelect}
          value={stateFilter}
          onChange={(e) => setStateFilter(e.target.value)}
        >
          <option value="all">Todos os estados ({patients.length})</option>
          {sortedStateEntries.map(([sigla, n]) => (
            <option key={sigla} value={sigla}>{stateName(sigla)} — {sigla} ({n})</option>
          ))}
        </select>

        <div className={styles.matchHint}>
          {filteredPatients.length} paciente(s) selecionado(s)
        </div>
      </div>

      <div className={styles.chartGrid}>
        <div className={styles.chartCard}>
          <div className={styles.chartHeader}>
            <h3>Pressão arterial média — últimos 7 dias</h3>
            <span className={styles.chartHint}>mmHg</span>
          </div>
          <div className={styles.chart}>
            {loading ? (
              <div className={styles.shimmer} />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={series} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
                  <CartesianGrid stroke="rgba(28,25,23,0.08)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} stroke="rgba(28,25,23,0.4)" />
                  <YAxis fontSize={11} tickLine={false} axisLine={false} stroke="rgba(28,25,23,0.4)" domain={[60, 180]} />
                  <Tooltip
                    contentStyle={{ borderRadius: 10, border: 0, boxShadow: '0 6px 24px rgba(0,0,0,0.12)' }}
                    formatter={(v: number, name: string) => [`${v} mmHg`, name === 'systolic' ? 'Sistólica' : 'Diastólica']}
                  />
                  <Line type="monotone" dataKey="systolic" stroke="#E84E1B" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                  <Line type="monotone" dataKey="diastolic" stroke="#4A1340" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className={styles.chartCard}>
          <div className={styles.chartHeader}>
            <h3>Frequência cardíaca média — últimos 7 dias</h3>
            <span className={styles.chartHint}>bpm</span>
          </div>
          <div className={styles.chart}>
            {loading ? (
              <div className={styles.shimmer} />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={series} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
                  <CartesianGrid stroke="rgba(28,25,23,0.08)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} stroke="rgba(28,25,23,0.4)" />
                  <YAxis fontSize={11} tickLine={false} axisLine={false} stroke="rgba(28,25,23,0.4)" domain={[40, 130]} />
                  <Tooltip
                    contentStyle={{ borderRadius: 10, border: 0, boxShadow: '0 6px 24px rgba(0,0,0,0.12)' }}
                    formatter={(v: number) => [`${v} bpm`, 'FC média']}
                  />
                  <Line type="monotone" dataKey="hr" stroke="#4A1340" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div className={styles.chartCard}>
        <div className={styles.chartHeader}>
          <h3>Glicemia média — últimos 7 dias</h3>
          <span className={styles.chartHint}>mg/dL</span>
        </div>
        <div className={styles.chart}>
          {loading ? (
            <div className={styles.shimmer} />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={glucoseSeries} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
                <CartesianGrid stroke="rgba(74,19,64,0.08)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} stroke="rgba(74,19,64,0.4)" />
                <YAxis fontSize={11} tickLine={false} axisLine={false} stroke="rgba(74,19,64,0.4)" domain={[60, 240]} />
                <Tooltip
                  contentStyle={{ borderRadius: 10, border: 0, boxShadow: '0 6px 24px rgba(74,19,64,0.12)' }}
                  formatter={(v: number, _name, item) => {
                    const payload = (item as { payload?: DailyGlucose })?.payload
                    const count = payload?.count ?? 0
                    return [
                      count > 0 ? `${v} mg/dL · ${count} medição(ões)` : 'sem dados',
                      'Glicemia média',
                    ]
                  }}
                />
                <Line type="monotone" dataKey="avg" stroke="#E84E1B" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className={styles.heatCard}>
        <div className={styles.chartHeader}>
          <h3>Mapa do Brasil — pacientes por estado</h3>
          <span className={styles.chartHint}>protótipo · estado fictício até cadastro de endereço</span>
        </div>
        <BrazilMap
          counts={stateCounts}
          selected={stateFilter === 'all' ? null : stateFilter}
          onSelect={(s) => setStateFilter(s || 'all')}
        />
      </div>
    </section>
  )
}
