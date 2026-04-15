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
    improving: { icon: '📉', label: 'Melhorando', color: 'var(--cardio-green)' },
    stable: { icon: '➡️', label: 'Estavel', color: 'var(--cardio-blue)' },
    worsening: { icon: '📈', label: 'Piorando', color: 'var(--cardio-red)' },
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
        <div className={styles.averagesGrid}>
          <div className={styles.avgCard}>
            <div className={styles.avgPeriod}>7 dias</div>
            {weekly ? (
              <>
                <div className={styles.avgValue}>
                  {weekly.systolic}/{weekly.diastolic}
                </div>
                <div className={styles.avgCount}>{weekly.count} medicoes</div>
              </>
            ) : (
              <div className={styles.avgEmpty}>Sem dados</div>
            )}
          </div>
          <div className={styles.avgCard}>
            <div className={styles.avgPeriod}>30 dias</div>
            {monthly ? (
              <>
                <div className={styles.avgValue}>
                  {monthly.systolic}/{monthly.diastolic}
                </div>
                <div className={styles.avgCount}>{monthly.count} medicoes</div>
              </>
            ) : (
              <div className={styles.avgEmpty}>Sem dados</div>
            )}
          </div>
        </div>
      </div>

      {/* Trend */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Tendencia</h2>
        <div className={styles.trendCard}>
          <span className={styles.trendIcon}>{trendInfo.icon}</span>
          <span className={styles.trendLabel} style={{ color: trendInfo.color }}>
            {trendInfo.label}
          </span>
          <span className={styles.trendDesc}>
            {trend === 'improving'
              ? 'Sua pressao esta diminuindo'
              : trend === 'worsening'
              ? 'Sua pressao esta aumentando'
              : 'Sua pressao esta estavel'}
          </span>
        </div>
      </div>

      {/* Distribution */}
      {pieData.length > 0 && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Distribuicao</h2>
          <div className={styles.pieWrapper}>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
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
                    <span
                      className={styles.legendDot}
                      style={{ background: cc.color }}
                    />
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
        <h2 className={styles.sectionTitle}>Manha vs Noite</h2>
        <div className={styles.averagesGrid}>
          <div className={styles.avgCard}>
            <div className={styles.avgPeriod}>🌅 Manha (5h-12h)</div>
            {timeOfDay.morning ? (
              <div className={styles.avgValue}>
                {timeOfDay.morning.systolic}/{timeOfDay.morning.diastolic}
              </div>
            ) : (
              <div className={styles.avgEmpty}>Sem dados</div>
            )}
          </div>
          <div className={styles.avgCard}>
            <div className={styles.avgPeriod}>🌙 Noite (17h-23h)</div>
            {timeOfDay.evening ? (
              <div className={styles.avgValue}>
                {timeOfDay.evening.systolic}/{timeOfDay.evening.diastolic}
              </div>
            ) : (
              <div className={styles.avgEmpty}>Sem dados</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
