import { useState, useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, ReferenceLine,
  ResponsiveContainer, Tooltip,
} from 'recharts'
import { usePatientData } from '../hooks/usePatientData'
import { classifyBP, classificationConfig } from '../config/theme'
import { classifyGlucose, glucoseContextLabel } from '../config/glucose'
import type { GlucoseMeasurement, Measurement } from '../models/types'
import AnalyticsView from './AnalyticsView'
import AppPageHeader from './AppPageHeader'
import styles from './HistoryView.module.css'

type Period = 7 | 30 | 90
type SubTab = 'history' | 'analytics'
type MeasurementKind = 'all' | 'pressure' | 'glucose'

type TimelineItem =
  | { kind: 'pressure'; measuredAt: string; measurement: Measurement }
  | { kind: 'glucose'; measuredAt: string; measurement: GlucoseMeasurement }

export default function HistoryView() {
  const { allMeasurements, allGlucoseMeasurements } = usePatientData()
  const [period, setPeriod] = useState<Period>(7)
  const [subTab, setSubTab] = useState<SubTab>('history')
  const [kind, setKind] = useState<MeasurementKind>('all')

  const { pressureFiltered, glucoseFiltered } = useMemo(() => {
    const since = new Date()
    since.setDate(since.getDate() - period)
    return {
      pressureFiltered: allMeasurements.filter((m) => new Date(m.measuredAt) >= since),
      glucoseFiltered: allGlucoseMeasurements.filter((m) => new Date(m.measuredAt) >= since),
    }
  }, [allMeasurements, allGlucoseMeasurements, period])

  const timeline = useMemo<TimelineItem[]>(() => {
    const pressure: TimelineItem[] = kind === 'glucose' ? [] : pressureFiltered.map((measurement) => ({
      kind: 'pressure', measuredAt: measurement.measuredAt, measurement,
    }))
    const glucose: TimelineItem[] = kind === 'pressure' ? [] : glucoseFiltered.map((measurement) => ({
      kind: 'glucose', measuredAt: measurement.measuredAt, measurement,
    }))
    return [...pressure, ...glucose].sort((a, b) => Date.parse(b.measuredAt) - Date.parse(a.measuredAt))
  }, [kind, pressureFiltered, glucoseFiltered])

  const pressureChartData = useMemo(
    () =>
      [...pressureFiltered].reverse().map((m) => ({
        date: new Date(m.measuredAt).toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
        }),
        sistólica: m.systolic,
        diastólica: m.diastolic,
      })),
    [pressureFiltered]
  )

  const glucoseChartData = useMemo(
    () =>
      [...glucoseFiltered].reverse().map((m) => ({
        date: new Date(m.measuredAt).toLocaleDateString('pt-BR', {
          day: '2-digit', month: '2-digit',
        }),
        glicemia: m.value,
      })),
    [glucoseFiltered]
  )

  return (
    <div className={styles.container}>
      <AppPageHeader title="Histórico" subtitle="Pressão, glicose e tendências" />

      <div className={styles.subTabs}>
        {(['history', 'analytics'] as SubTab[]).map((t) => (
          <button
            key={t}
            className={`${styles.subTab} ${subTab === t ? styles.subTabActive : ''}`}
            onClick={() => setSubTab(t)}
          >
            {t === 'history' ? 'Medições' : 'Análise de PA'}
          </button>
        ))}
      </div>

      {subTab === 'analytics' ? (
        <AnalyticsView measurements={allMeasurements} />
      ) : (
        <>
          <div className={styles.periodPicker}>
            {([7, 30, 90] as Period[]).map((p) => (
              <button
                key={p}
                className={`${styles.periodBtn} ${period === p ? styles.periodActive : ''}`}
                onClick={() => setPeriod(p)}
              >
                {p} dias
              </button>
            ))}
          </div>

          <div className={styles.kindPicker} aria-label="Filtrar tipo de medição">
            {([
              ['all', 'Todos'],
              ['pressure', `Pressão (${pressureFiltered.length})`],
              ['glucose', `Glicose (${glucoseFiltered.length})`],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={`${styles.kindBtn} ${kind === value ? styles.kindActive : ''}`}
                onClick={() => setKind(value)}
              >
                {label}
              </button>
            ))}
          </div>

          {kind === 'pressure' && pressureChartData.length > 1 && (
            <div className={styles.chartCard}>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={pressureChartData} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
                  <XAxis
                    dataKey="date"
                    tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    domain={['auto', 'auto']}
                  />
                  <Tooltip
                    contentStyle={{
                      background: '#2C2C2E',
                      border: 'none',
                      borderRadius: 12,
                      color: '#FFF',
                      fontSize: 14,
                      boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
                    }}
                  />
                  <ReferenceLine y={140} stroke="rgba(255,59,48,0.3)" strokeDasharray="4 4" />
                  <ReferenceLine y={90} stroke="rgba(0,122,255,0.3)" strokeDasharray="4 4" />
                  <Line
                    type="monotone"
                    dataKey="sistólica"
                    stroke="#FF3B30"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: '#FF3B30', strokeWidth: 0 }}
                    activeDot={{ r: 5, fill: '#FF3B30' }}
                    name="Sistólica"
                  />
                  <Line
                    type="monotone"
                    dataKey="diastólica"
                    stroke="#007AFF"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: '#007AFF', strokeWidth: 0 }}
                    activeDot={{ r: 5, fill: '#007AFF' }}
                    name="Diastólica"
                  />
                </LineChart>
              </ResponsiveContainer>
              <div className={styles.chartLegend}>
                <span className={styles.legendItem}>
                  <span className={styles.legendDot} style={{ background: '#FF3B30' }} />
                  Sistólica
                </span>
                <span className={styles.legendItem}>
                  <span className={styles.legendDot} style={{ background: '#007AFF' }} />
                  Diastólica
                </span>
              </div>
            </div>
          )}

          {kind === 'glucose' && glucoseChartData.length > 1 && (
            <div className={styles.chartCard}>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={glucoseChartData} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                  <XAxis dataKey="date" tick={{ fill: 'rgba(10,22,40,0.48)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'rgba(10,22,40,0.48)', fontSize: 11 }} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
                  <Tooltip
                    formatter={(value) => [`${value} mg/dL`, 'Glicemia']}
                    contentStyle={{ background: '#fff', border: '1px solid rgba(10,22,40,.1)', borderRadius: 12, color: '#0A1628', fontSize: 14 }}
                  />
                  <ReferenceLine y={70} stroke="rgba(220,38,38,0.35)" strokeDasharray="4 4" />
                  <Line type="monotone" dataKey="glicemia" stroke="#C5A050" strokeWidth={2.5} dot={{ r: 3, fill: '#C5A050', strokeWidth: 0 }} activeDot={{ r: 5, fill: '#C5A050' }} name="Glicemia" />
                </LineChart>
              </ResponsiveContainer>
              <div className={styles.chartLegend}>
                <span className={styles.legendItem}>
                  <span className={styles.legendDot} style={{ background: '#C5A050' }} />
                  Glicemia (mg/dL)
                </span>
              </div>
            </div>
          )}

          <div className={styles.list}>
            {timeline.length === 0 ? (
              <div className={styles.empty}>
                <p className={styles.emptyTitle}>Sem medições</p>
                <p className={styles.emptyDesc}>Nenhuma medição nos últimos {period} dias</p>
              </div>
            ) : (
              timeline.map((item) => {
                const measuredAt = new Date(item.measuredAt)
                if (item.kind === 'glucose') {
                  const m = item.measurement
                  const glucoseClass = classifyGlucose(m.value, m.context)
                  return (
                    <div key={`glucose-${m.id}`} className={styles.listItem}>
                      <div className={styles.listDot} style={{ background: glucoseClass.color }} />
                      <div className={styles.listContent}>
                        <span className={`${styles.kindBadge} ${styles.glucoseBadge}`}>Glicose</span>
                        <div className={styles.listBP}>
                          {m.value}<span className={styles.listUnit}> mg/dL</span>
                        </div>
                        <div className={styles.listClass} style={{ color: glucoseClass.color }}>
                          {glucoseClass.label}<span className={styles.listHR}> · {glucoseContextLabel(m.context)}</span>
                        </div>
                      </div>
                      <div className={styles.listTime}>
                        <div>{measuredAt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</div>
                        <div className={styles.listHour}>{measuredAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
                      </div>
                    </div>
                  )
                }

                const m = item.measurement
                const c = classifyBP(m.systolic, m.diastolic)
                const cc = classificationConfig[c]
                return (
                  <div key={`pressure-${m.id}`} className={styles.listItem}>
                    <div className={styles.listDot} style={{ background: cc.color }} />
                    <div className={styles.listContent}>
                      <span className={`${styles.kindBadge} ${styles.pressureBadge}`}>Pressão</span>
                      <div className={styles.listBP}>
                        {m.systolic}/{m.diastolic}
                        <span className={styles.listUnit}> mmHg</span>
                      </div>
                      <div className={styles.listClass} style={{ color: cc.color }}>
                        {cc.label}
                        {m.heartRate && <span className={styles.listHR}> · {m.heartRate} bpm</span>}
                      </div>
                    </div>
                    <div className={styles.listTime}>
                      <div>{measuredAt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</div>
                      <div className={styles.listHour}>
                        {measuredAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </>
      )}
    </div>
  )
}
