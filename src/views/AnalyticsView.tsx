import { useMemo } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import type { Measurement } from '../models/types'
import {
  weeklyAverage,
  monthlyAverage,
  trendAnalysis,
  classificationDistribution,
  morningVsEvening,
} from '../services/analyticsService'
import { classificationConfig } from '../config/theme'
import styles from './AnalyticsView.module.css'

interface Props {
  measurements: Measurement[]
}

export default function AnalyticsView({ measurements }: Props) {
  const weekly = useMemo(() => weeklyAverage(measurements), [measurements])
  const monthly = useMemo(() => monthlyAverage(measurements), [measurements])
  const trend = useMemo(() => trendAnalysis(measurements), [measurements])
  const distribution = useMemo(
    () => classificationDistribution(measurements),
    [measurements]
  )
  const timeOfDay = useMemo(() => morningVsEvening(measurements), [measurements])

  const trendInfo = {
    improving: { label: 'Melhorando', color: 'var(--cardio-green)', desc: 'Sua pressão está diminuindo' },
    stable: { label: 'Estável', color: 'var(--cardio-blue)', desc: 'Sua pressão está estável' },
    worsening: { label: 'Piorando', color: 'var(--cardio-red)', desc: 'Sua pressão está aumentando' },
  }[trend]

  const pieData = distribution.map((d) => ({
    name: classificationConfig[d.classification].label,
    value: d.count,
    color: classificationConfig[d.classification].color,
  }))

  return (
    <div className={styles.container}>
      {/* Averages */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Medias</h2>
        <div className={styles.grid}>
          <div className={styles.card}>
            <span className={styles.cardLabel}>7 dias</span>
            {weekly ? (
              <>
                <span className={styles.cardValue}>
                  {weekly.systolic}/{weekly.diastolic}
                </span>
                <span className={styles.cardMeta}>{weekly.count} medições</span>
              </>
            ) : (
              <span className={styles.cardEmpty}>Sem dados</span>
            )}
          </div>
          <div className={styles.card}>
            <span className={styles.cardLabel}>30 dias</span>
            {monthly ? (
              <>
                <span className={styles.cardValue}>
                  {monthly.systolic}/{monthly.diastolic}
                </span>
                <span className={styles.cardMeta}>{monthly.count} medições</span>
              </>
            ) : (
              <span className={styles.cardEmpty}>Sem dados</span>
            )}
          </div>
        </div>
      </div>

      {/* Trend */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Tendencia</h2>
        <div className={styles.trendCard}>
          <div className={styles.trendIndicator} style={{ background: trendInfo.color }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
              {trend === 'improving' ? (
                <polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/>
              ) : trend === 'worsening' ? (
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
              ) : (
                <line x1="1" y1="12" x2="23" y2="12"/>
              )}
            </svg>
          </div>
          <div className={styles.trendText}>
            <span className={styles.trendLabel} style={{ color: trendInfo.color }}>
              {trendInfo.label}
            </span>
            <span className={styles.trendDesc}>{trendInfo.desc}</span>
          </div>
        </div>
      </div>

      {/* Distribution */}
      {pieData.length > 0 && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Distribuicao</h2>
          <div className={styles.pieCard}>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                  cornerRadius={4}
                >
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className={styles.legend}>
              {distribution.map((d) => {
                const cc = classificationConfig[d.classification]
                return (
                  <div key={d.classification} className={styles.legendItem}>
                    <span className={styles.legendDot} style={{ background: cc.color }} />
                    <span className={styles.legendLabel}>{cc.label}</span>
                    <span className={styles.legendPct}>{d.percentage}%</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Time of Day */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Período do dia</h2>
        <div className={styles.grid}>
          <div className={styles.card}>
            <span className={styles.cardLabel}>Manha (5h-12h)</span>
            {timeOfDay.morning ? (
              <span className={styles.cardValue}>
                {timeOfDay.morning.systolic}/{timeOfDay.morning.diastolic}
              </span>
            ) : (
              <span className={styles.cardEmpty}>Sem dados</span>
            )}
          </div>
          <div className={styles.card}>
            <span className={styles.cardLabel}>Noite (17h-23h)</span>
            {timeOfDay.evening ? (
              <span className={styles.cardValue}>
                {timeOfDay.evening.systolic}/{timeOfDay.evening.diastolic}
              </span>
            ) : (
              <span className={styles.cardEmpty}>Sem dados</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
