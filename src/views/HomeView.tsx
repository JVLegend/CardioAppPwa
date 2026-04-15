import { useState } from 'react'
import { usePatientData } from '../hooks/usePatientData'
import { classifyBP, classificationConfig } from '../config/theme'
import ManualEntryView from './ManualEntryView'
import styles from './HomeView.module.css'

export default function HomeView() {
  const {
    allMeasurements,
    todayMeasurements,
    streak,
    activeAlerts,
    addMeasurement,
  } = usePatientData()

  const [showManualEntry, setShowManualEntry] = useState(false)

  const lastMeasurement = allMeasurements[0]
  const classification = lastMeasurement
    ? classifyBP(lastMeasurement.systolic, lastMeasurement.diastolic)
    : null
  const classConfig = classification ? classificationConfig[classification] : null

  const hasMeasuredToday = todayMeasurements.length > 0

  const handleSaveMeasurement = (sys: number, dia: number, hr?: number) => {
    addMeasurement(sys, dia, hr, 'manual')
    setShowManualEntry(false)
  }

  if (showManualEntry) {
    return (
      <ManualEntryView
        onSave={handleSaveMeasurement}
        onCancel={() => setShowManualEntry(false)}
      />
    )
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>CardioApp</h1>
        <p className={styles.subtitle}>Monitoramento de Pressao Arterial</p>
      </header>

      {/* Status Card */}
      <div className={styles.statusCard}>
        <div className={styles.streakRow}>
          <span className={styles.streakIcon}>🔥</span>
          <span className={styles.streakText}>
            {streak} {streak === 1 ? 'dia' : 'dias'} consecutivo{streak !== 1 ? 's' : ''}
          </span>
        </div>
        <div className={styles.dailyStatus}>
          {hasMeasuredToday ? (
            <span className={styles.statusDone}>✅ Medido hoje ({todayMeasurements.length})</span>
          ) : (
            <span className={styles.statusPending}>⏳ Nenhuma medicao hoje</span>
          )}
        </div>
      </div>

      {/* Last Measurement */}
      {lastMeasurement && classConfig && (
        <div className={styles.measurementCard} style={{ borderColor: classConfig.color }}>
          <div className={styles.measurementHeader}>
            <span>Ultima Medicao</span>
            <span className={styles.measurementTime}>
              {formatRelativeTime(lastMeasurement.measuredAt)}
            </span>
          </div>
          <div className={styles.measurementValues}>
            <span className={styles.bpValue} style={{ color: classConfig.color }}>
              {lastMeasurement.systolic}
            </span>
            <span className={styles.bpSeparator}>/</span>
            <span className={styles.bpValueSmall}>
              {lastMeasurement.diastolic}
            </span>
            <span className={styles.bpUnit}>mmHg</span>
          </div>
          <div className={styles.classificationRow}>
            <span>{classConfig.emoji}</span>
            <span style={{ color: classConfig.color }}>{classConfig.label}</span>
          </div>
          {lastMeasurement.heartRate && (
            <div className={styles.heartRate}>
              ❤️ {lastMeasurement.heartRate} bpm
            </div>
          )}
        </div>
      )}

      {/* Alerts */}
      {activeAlerts.length > 0 && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Alertas Ativos</h2>
          {activeAlerts.map((alert) => (
            <div
              key={alert.id}
              className={styles.alertItem}
              style={{
                borderLeftColor:
                  alert.type === 'urgent'
                    ? 'var(--cardio-red)'
                    : alert.type === 'attention'
                    ? 'var(--cardio-orange)'
                    : 'var(--cardio-yellow)',
              }}
            >
              <span className={styles.alertIcon}>
                {alert.type === 'urgent' ? '🚨' : '⚡'}
              </span>
              <div>
                <div className={styles.alertType}>
                  {alert.type === 'urgent' ? 'Urgente' : 'Atencao'}
                </div>
                <div className={styles.alertRule}>{alert.rule}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className={styles.actions}>
        <button
          className={styles.actionBtn}
          style={{ background: 'var(--cardio-blue)' }}
          onClick={() => {
            // Navigate to Bluetooth tab is handled by MainTabView
            // For now, show manual entry with BLE note
            setShowManualEntry(true)
          }}
        >
          📱 Aferir via Aparelho
        </button>
        <button
          className={styles.actionBtn}
          style={{ background: 'var(--cardio-green)' }}
          onClick={() => setShowManualEntry(true)}
        >
          ⌨️ Registro Manual
        </button>
      </div>

      {/* Today's Measurements */}
      {todayMeasurements.length > 0 && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Hoje</h2>
          {todayMeasurements.map((m) => {
            const c = classifyBP(m.systolic, m.diastolic)
            const cc = classificationConfig[c]
            return (
              <div key={m.id} className={styles.todayItem}>
                <div className={styles.todayLeft}>
                  <span style={{ color: cc.color }}>{cc.emoji}</span>
                  <span className={styles.todayBP}>
                    {m.systolic}/{m.diastolic}
                  </span>
                  {m.heartRate && (
                    <span className={styles.todayHR}>❤️ {m.heartRate}</span>
                  )}
                </div>
                <div className={styles.todayRight}>
                  <span className={styles.todaySource}>
                    {m.source === 'ble' ? '📱' : '⌨️'}
                  </span>
                  <span className={styles.todayTime}>
                    {new Date(m.measuredAt).toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function formatRelativeTime(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'agora'
  if (minutes < 60) return `${minutes}min atras`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h atras`
  const days = Math.floor(hours / 24)
  return `${days}d atras`
}
