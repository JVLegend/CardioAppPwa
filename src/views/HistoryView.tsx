import { useState, useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, ReferenceLine,
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
        systolic: m.systolic,
        diastolic: m.diastolic,
      })),
    [filtered]
  )

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Historico</h1>

      {/* Sub tabs */}
      <div className={styles.subTabs}>
        <button
          className={`${styles.subTab} ${subTab === 'history' ? styles.subTabActive : ''}`}
          onClick={() => setSubTab('history')}
        >
          Historico
        </button>
        <button
          className={`${styles.subTab} ${subTab === 'analytics' ? styles.subTabActive : ''}`}
          onClick={() => setSubTab('analytics')}
        >
          Analise
        </button>
      </div>

      {subTab === 'analytics' ? (
        <AnalyticsView measurements={allMeasurements} />
      ) : (
        <>
          {/* Period Picker */}
          <div className={styles.periodPicker}>
            {([7, 30, 90] as Period[]).map((p) => (
              <button
                key={p}
                className={`${styles.periodBtn} ${period === p ? styles.periodActive : ''}`}
                onClick={() => setPeriod(p)}
              >
                {p}d
              </button>
            ))}
          </div>

          {/* Chart */}
          {chartData.length > 1 && (
            <div className={styles.chartWrapper}>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2A2A40" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: '#6B6B80', fontSize: 11 }}
                    axisLine={{ stroke: '#2A2A40' }}
                  />
                  <YAxis
                    tick={{ fill: '#6B6B80', fontSize: 11 }}
                    axisLine={{ stroke: '#2A2A40' }}
                    domain={['auto', 'auto']}
                  />
                  <Tooltip
                    contentStyle={{
                      background: '#1E1E32',
                      border: '1px solid #2A2A40',
                      borderRadius: 8,
                      color: '#FFF',
                    }}
                  />
                  <ReferenceLine y={140} stroke="#D42E2E" strokeDasharray="5 5" strokeOpacity={0.5} />
                  <ReferenceLine y={90} stroke="#2E5AA5" strokeDasharray="5 5" strokeOpacity={0.5} />
                  <Line
                    type="monotone"
                    dataKey="systolic"
                    stroke="#D42E2E"
                    strokeWidth={2}
                    dot={{ r: 3, fill: '#D42E2E' }}
                    name="Sistolica"
                  />
                  <Line
                    type="monotone"
                    dataKey="diastolic"
                    stroke="#2E5AA5"
                    strokeWidth={2}
                    dot={{ r: 3, fill: '#2E5AA5' }}
                    name="Diastolica"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Measurement List */}
          <div className={styles.list}>
            {filtered.length === 0 ? (
              <div className={styles.empty}>Nenhuma medicao neste periodo</div>
            ) : (
              filtered.map((m) => {
                const c = classifyBP(m.systolic, m.diastolic)
                const cc = classificationConfig[c]
                return (
                  <div key={m.id} className={styles.listItem}>
                    <div className={styles.listLeft}>
                      <span
                        className={styles.listDot}
                        style={{ background: cc.color }}
                      />
                      <div>
                        <div className={styles.listBP}>
                          {m.systolic}/{m.diastolic}{' '}
                          <span className={styles.listUnit}>mmHg</span>
                        </div>
                        <div className={styles.listClass} style={{ color: cc.color }}>
                          {cc.emoji} {cc.label}
                        </div>
                      </div>
                    </div>
                    <div className={styles.listRight}>
                      <div className={styles.listDate}>
                        {new Date(m.measuredAt).toLocaleDateString('pt-BR')}
                      </div>
                      <div className={styles.listTime}>
                        {new Date(m.measuredAt).toLocaleTimeString('pt-BR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
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
