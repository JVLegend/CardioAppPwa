// Renderiza apenas os 3 gráficos (PA, FC, Glicemia) em grid de 3 colunas.
// Search, filtro de estado e mapa do Brasil ficam no ControllerDashboardView,
// que passa a lista já filtrada de pacientes para cá.
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

interface DailyGlucose {
  date: string
  label: string
  avg: number
  count: number
}

export default function DashboardCharts({ patients }: Props) {
  const [series, setSeries] = useState<DailyAvg[]>([])
  const [glucoseSeries, setGlucoseSeries] = useState<DailyGlucose[]>([])
  const [loading, setLoading] = useState(true)

  const patientIds = useMemo(() => patients.map((p) => p.id).sort().join(','), [patients])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const ids = new Set(patients.map((p) => p.id))
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - 6)

      const [allMeas, allGlc] = await Promise.all([
        db.measurements.toArray(),
        db.glucoseMeasurements.toArray(),
      ])
      if (cancelled) return
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
      if (cancelled) return
      setSeries(out)
      setGlucoseSeries(outGlc)
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientIds])

  return (
    <div className={styles.chartGrid}>
      <div className={styles.chartCard}>
        <div className={styles.chartHeader}>
          <h3>Pressão arterial</h3>
          <span className={styles.chartHint}>mmHg · média diária</span>
        </div>
        <div className={styles.chart}>
          {loading ? (
            <div className={styles.shimmer} />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                <CartesianGrid stroke="rgba(74,19,64,0.08)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" fontSize={10} tickLine={false} axisLine={false} stroke="rgba(74,19,64,0.4)" />
                <YAxis fontSize={10} tickLine={false} axisLine={false} stroke="rgba(74,19,64,0.4)" domain={[60, 180]} />
                <Tooltip
                  contentStyle={{ borderRadius: 10, border: 0, boxShadow: '0 6px 24px rgba(74,19,64,0.12)' }}
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
          <h3>Frequência cardíaca</h3>
          <span className={styles.chartHint}>bpm · média diária</span>
        </div>
        <div className={styles.chart}>
          {loading ? (
            <div className={styles.shimmer} />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                <CartesianGrid stroke="rgba(74,19,64,0.08)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" fontSize={10} tickLine={false} axisLine={false} stroke="rgba(74,19,64,0.4)" />
                <YAxis fontSize={10} tickLine={false} axisLine={false} stroke="rgba(74,19,64,0.4)" domain={[40, 130]} />
                <Tooltip
                  contentStyle={{ borderRadius: 10, border: 0, boxShadow: '0 6px 24px rgba(74,19,64,0.12)' }}
                  formatter={(v: number) => [`${v} bpm`, 'FC média']}
                />
                <Line type="monotone" dataKey="hr" stroke="#4A1340" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className={styles.chartCard}>
        <div className={styles.chartHeader}>
          <h3>Glicemia</h3>
          <span className={styles.chartHint}>mg/dL · média diária</span>
        </div>
        <div className={styles.chart}>
          {loading ? (
            <div className={styles.shimmer} />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={glucoseSeries} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                <CartesianGrid stroke="rgba(74,19,64,0.08)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" fontSize={10} tickLine={false} axisLine={false} stroke="rgba(74,19,64,0.4)" />
                <YAxis fontSize={10} tickLine={false} axisLine={false} stroke="rgba(74,19,64,0.4)" domain={[60, 240]} />
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
    </div>
  )
}
