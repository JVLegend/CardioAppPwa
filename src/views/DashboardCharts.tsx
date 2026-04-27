import { useEffect, useMemo, useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import type { Patient } from '../models/types'
import { db } from '../services/database'
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

// Cidades fictícias para o mapa de calor enquanto o cadastro de endereço
// não está em produção. Distribuição determinística por id do paciente.
const DEMO_CITIES = [
  'São Paulo', 'Rio de Janeiro', 'Belo Horizonte', 'Curitiba', 'Salvador',
  'Recife', 'Porto Alegre', 'Fortaleza', 'Brasília', 'Campinas',
]

function cityFor(patientId: string): string {
  let hash = 0
  for (let i = 0; i < patientId.length; i++) {
    hash = (hash * 31 + patientId.charCodeAt(i)) >>> 0
  }
  return DEMO_CITIES[hash % DEMO_CITIES.length]
}

export default function DashboardCharts({ patients }: Props) {
  const [search, setSearch] = useState('')
  const [region, setRegion] = useState<string>('all')
  const [series, setSeries] = useState<DailyAvg[]>([])
  const [loading, setLoading] = useState(true)

  const filteredPatients = useMemo(() => {
    const q = search.trim().toLowerCase()
    return patients.filter((p) => {
      if (region !== 'all' && cityFor(p.id) !== region) return false
      if (!q) return true
      return (
        p.name.toLowerCase().includes(q) ||
        (p.phone || '').toLowerCase().includes(q) ||
        (p.comorbidities || []).some((c) => c.toLowerCase().includes(q))
      )
    })
  }, [patients, search, region])

  const cityCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const p of patients) {
      const city = cityFor(p.id)
      counts.set(city, (counts.get(city) ?? 0) + 1)
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
  }, [patients])

  const maxCity = cityCounts[0]?.[1] ?? 1

  useEffect(() => {
    async function load() {
      setLoading(true)
      const ids = new Set(filteredPatients.map((p) => p.id))
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - 6)

      const all = await db.measurements.toArray()
      const recent = all.filter((m) => ids.has(m.patientId) && new Date(m.measuredAt) >= cutoff)

      const byDay = new Map<string, { sys: number[]; dia: number[]; hr: number[] }>()
      for (let i = 6; i >= 0; i--) {
        const d = new Date()
        d.setDate(d.getDate() - i)
        const key = d.toISOString().slice(0, 10)
        byDay.set(key, { sys: [], dia: [], hr: [] })
      }
      for (const m of recent) {
        const key = new Date(m.measuredAt).toISOString().slice(0, 10)
        const bucket = byDay.get(key)
        if (!bucket) continue
        bucket.sys.push(m.systolic)
        bucket.dia.push(m.diastolic)
        if (m.heartRate) bucket.hr.push(m.heartRate)
      }
      const out: DailyAvg[] = Array.from(byDay.entries()).map(([date, b]) => {
        const avg = (xs: number[]) => xs.length ? Math.round(xs.reduce((a, c) => a + c, 0) / xs.length) : 0
        const d = new Date(date)
        return {
          date,
          label: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
          systolic: avg(b.sys),
          diastolic: avg(b.dia),
          hr: avg(b.hr),
          count: b.sys.length,
        }
      })
      setSeries(out)
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
          value={region}
          onChange={(e) => setRegion(e.target.value)}
        >
          <option value="all">Todas as regiões ({patients.length})</option>
          {cityCounts.map(([city, n]) => (
            <option key={city} value={city}>{city} ({n})</option>
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
                  <Line type="monotone" dataKey="systolic" stroke="#C41230" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                  <Line type="monotone" dataKey="diastolic" stroke="#1D4ED8" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
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
                  <Line type="monotone" dataKey="hr" stroke="#16A34A" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div className={styles.heatCard}>
        <div className={styles.chartHeader}>
          <h3>Mapa de calor — pacientes por cidade</h3>
          <span className={styles.chartHint}>protótipo · usa cidade fictícia até cadastro de endereço</span>
        </div>
        <div className={styles.heatGrid}>
          {cityCounts.map(([city, n]) => {
            const intensity = Math.max(0.18, n / maxCity)
            return (
              <button
                key={city}
                className={styles.heatTile}
                style={{ background: `rgba(196, 18, 48, ${intensity})` }}
                onClick={() => setRegion(region === city ? 'all' : city)}
                aria-pressed={region === city}
              >
                <span className={styles.heatCity}>{city}</span>
                <span className={styles.heatCount}>{n}</span>
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}
