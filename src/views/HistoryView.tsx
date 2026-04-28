import { useState, useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, ReferenceLine,
  ResponsiveContainer, Tooltip,
} from 'recharts'
import { usePatientData } from '../hooks/usePatientData'
import { classifyBP, classificationConfig } from '../config/theme'
import AnalyticsView from './AnalyticsView'
import styles from './HistoryView.module.css'

type Period = 7 | 30 | 90
type SubTab = 'history' | 'analytics'

export default function HistoryView() {
  const { allMeasurements } = usePatientData()
  const [period, setPeriod] = useState<Period>(7)
  const [subTab, setSubTab] = useState<SubTab>('history')

  const filtered = useMemo(() => {
    const since = new Date()
    since.setDate(since.getDate() - period)
    return allMeasurements.filter((m) => new Date(m.measuredAt) >= since)
  }, [allMeasurements, period])

  const chartData = useMemo(
    () =>
      [...filtered].reverse().map((m) => ({
        date: new Date(m.measuredAt).toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
        }),
        sistólica: m.systolic,
        diastólica: m.diastolic,
      })),
    [filtered]
  )

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Histórico</h1>

      <div className={styles.subTabs}>
        {(['history', 'analytics'] as SubTab[]).map((t) => (
          <button
            key={t}
            className={`${styles.subTab} ${subTab === t ? styles.subTabActive : ''}`}
            onClick={() => setSubTab(t)}
          >
            {t === 'history' ? 'Medições' : 'Analise'}
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

          {chartData.length > 1 && (
            <div className={styles.chartCard}>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
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

          <div className={styles.list}>
            {filtered.length === 0 ? (
              <div className={styles.empty}>
                <p className={styles.emptyTitle}>Sem medições</p>
                <p className={styles.emptyDesc}>Nenhuma medição nos ultimos {period} dias</p>
              </div>
            ) : (
              filtered.map((m) => {
                const c = classifyBP(m.systolic, m.diastolic)
                const cc = classificationConfig[c]
                return (
                  <div key={m.id} className={styles.listItem}>
                    <div className={styles.listDot} style={{ background: cc.color }} />
                    <div className={styles.listContent}>
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
                      <div>{new Date(m.measuredAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</div>
                      <div className={styles.listHour}>
                        {new Date(m.measuredAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
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
