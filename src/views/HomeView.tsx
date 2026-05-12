import { useRef, useState, type ChangeEvent } from 'react'
import { usePatientData } from '../hooks/usePatientData'
import { classifyBP, classificationConfig } from '../config/theme'
import ManualEntryView from './ManualEntryView'
import FloatingChat from './FloatingChat'
import BluetoothView from './BluetoothView'
import { readBpFromImage, MissingGeminiKeyError, type BpReading } from '../services/bpOcr'
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
  const [photoReading, setPhotoReading] = useState<BpReading | null>(null)
  const [ocrLoading, setOcrLoading] = useState(false)
  const [ocrError, setOcrError] = useState('')
  const cameraRef = useRef<HTMLInputElement>(null)

  const lastMeasurement = allMeasurements[0]
  const classification = lastMeasurement
    ? classifyBP(lastMeasurement.systolic, lastMeasurement.diastolic)
    : null
  const classConfig = classification ? classificationConfig[classification] : null

  const hasMeasuredToday = todayMeasurements.length > 0
  const dailyGoal = 2
  const dailyProgress = Math.min(todayMeasurements.length / dailyGoal, 1)
  const circumference = 2 * Math.PI * 45

  const handleSaveMeasurement = (sys: number, dia: number, hr?: number) => {
    addMeasurement(sys, dia, hr, 'manual')
    setShowManualEntry(false)
    setPhotoReading(null)
  }

  const handlePhotoCapture = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setOcrLoading(true)
    setOcrError('')
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = (ev) => resolve(ev.target?.result as string)
        reader.onerror = () => reject(reader.error)
        reader.readAsDataURL(file)
      })
      const base64 = dataUrl.split(',')[1]
      const mimeType = file.type || 'image/jpeg'
      const reading = await readBpFromImage(base64, mimeType)
      if (reading.systolic === null && reading.diastolic === null && reading.heartRate === null) {
        setOcrError('A IA não conseguiu ler nenhum número. Tente outra foto ou registre manualmente.')
      } else {
        setPhotoReading(reading)
        setShowManualEntry(true)
      }
    } catch (err) {
      console.error(err)
      if (err instanceof MissingGeminiKeyError) {
        setOcrError('Leitura por foto não está configurada (falta VITE_GEMINI_API_KEY).')
      } else {
        setOcrError('Erro ao ler a foto. Tente novamente.')
      }
    } finally {
      setOcrLoading(false)
    }
  }

  if (showManualEntry) {
    return (
      <ManualEntryView
        onSave={handleSaveMeasurement}
        onCancel={() => { setShowManualEntry(false); setPhotoReading(null) }}
        initialSystolic={photoReading?.systolic ?? undefined}
        initialDiastolic={photoReading?.diastolic ?? undefined}
        initialHeartRate={photoReading?.heartRate ?? undefined}
        fromPhoto={!!photoReading}
      />
    )
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>CardioApp</h1>
          <p className={styles.date}>
            {new Date().toLocaleDateString('pt-BR', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </p>
        </div>
      </header>

      {/* Progress Ring + Streak */}
      <div className={styles.progressSection}>
        <div className={styles.ringContainer}>
          <svg viewBox="0 0 100 100" className={styles.ring}>
            <circle
              cx="50" cy="50" r="45"
              fill="none"
              stroke="var(--border-light)"
              strokeWidth="6"
            />
            <circle
              cx="50" cy="50" r="45"
              fill="none"
              stroke={hasMeasuredToday ? 'var(--cardio-green)' : 'var(--cardio-red)'}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - dailyProgress)}
              transform="rotate(-90 50 50)"
              style={{ transition: 'stroke-dashoffset 1s ease' }}
            />
          </svg>
          <div className={styles.ringCenter}>
            <span className={styles.ringCount}>{todayMeasurements.length}</span>
            <span className={styles.ringLabel}>de {dailyGoal}</span>
          </div>
        </div>
        <div className={styles.statsRow}>
          <div className={styles.stat}>
            <span className={styles.statValue}>{streak}</span>
            <span className={styles.statLabel}>
              {streak === 1 ? 'dia' : 'dias'} seguidos
            </span>
          </div>
          <div className={styles.statDivider} />
          <div className={styles.stat}>
            <span className={styles.statValue}>{allMeasurements.length}</span>
            <span className={styles.statLabel}>total medições</span>
          </div>
          <div className={styles.statDivider} />
          <div className={styles.stat}>
            <span className={styles.statValue}>
              {hasMeasuredToday ? 'Feito' : 'Pendente'}
            </span>
            <span className={styles.statLabel}>hoje</span>
          </div>
        </div>
      </div>

      {/* Level / Badge */}
      {streak > 0 && (
        <div className={styles.badgeCard}>
          <div className={styles.badgeIcon}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="var(--cardio-yellow)" />
            </svg>
          </div>
          <div className={styles.badgeText}>
            <span className={styles.badgeTitle}>
              {streak >= 30 ? 'Mestre da Saúde' : streak >= 14 ? 'Dedicado' : streak >= 7 ? 'Consistente' : streak >= 3 ? 'Boa fase' : 'Iniciando'}
            </span>
            <span className={styles.badgeDesc}>
              {streak >= 30
                ? `${streak} dias seguidos, incrível!`
                : streak >= 7
                ? `Continue assim! ${streak} dias`
                : `${streak} dia${streak > 1 ? 's' : ''} — não pare!`}
            </span>
          </div>
        </div>
      )}

      {/* Last Measurement */}
      {lastMeasurement && classConfig && (
        <div className={styles.measurementCard}>
          <div className={styles.measurementHeader}>
            <span className={styles.measurementLabel}>Última medição</span>
            <span className={styles.measurementTime}>
              {formatRelativeTime(lastMeasurement.measuredAt)}
            </span>
          </div>
          <div className={styles.measurementBody}>
            <div className={styles.bpDisplay}>
              <span className={styles.bpSys} style={{ color: classConfig.color }}>
                {lastMeasurement.systolic}
              </span>
              <span className={styles.bpSlash}>/</span>
              <span className={styles.bpDia}>{lastMeasurement.diastolic}</span>
            </div>
            <span className={styles.bpUnit}>mmHg</span>
          </div>
          <div className={styles.classRow}>
            <span
              className={styles.classDot}
              style={{ background: classConfig.color }}
            />
            <span
              className={styles.classLabel}
              style={{ color: classConfig.color }}
            >
              {classConfig.label}
            </span>
          </div>
          {lastMeasurement.heartRate && (
            <div className={styles.hrRow}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--cardio-red)">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
              </svg>
              <span className={styles.hrValue}>{lastMeasurement.heartRate} bpm</span>
            </div>
          )}
        </div>
      )}

      {/* Alerts */}
      {activeAlerts.length > 0 && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Alertas</h2>
          {activeAlerts.map((alert) => (
            <div
              key={alert.id}
              className={styles.alertCard}
              style={{
                borderLeftColor:
                  alert.type === 'urgent' ? 'var(--cardio-red)' : 'var(--cardio-orange)',
              }}
            >
              <div className={styles.alertIcon}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={alert.type === 'urgent' ? 'var(--cardio-red)' : 'var(--cardio-orange)'} strokeWidth="2">
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
              <div>
                <div className={styles.alertTitle}>
                  {alert.type === 'urgent' ? 'Urgente' : 'Atencao'}
                </div>
                <div className={styles.alertDesc}>{alert.rule}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className={styles.actions}>
        <button className={styles.primaryAction} onClick={() => setShowManualEntry(true)}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Nova Medição
        </button>

        <button
          className={styles.primaryAction}
          style={{ background: 'var(--leve-plum)', marginTop: 8 }}
          onClick={() => cameraRef.current?.click()}
          disabled={ocrLoading}
        >
          {ocrLoading ? (
            <>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 1s linear infinite' }}>
                <path d="M21 12a9 9 0 11-6.219-8.56"/>
              </svg>
              Lendo aparelho...
            </>
          ) : (
            <>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
              Tirar foto do aparelho
            </>
          )}
        </button>

        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: 'none' }}
          onChange={handlePhotoCapture}
        />

        {ocrError && (
          <div
            style={{
              marginTop: 8,
              padding: '10px 14px',
              borderRadius: 12,
              background: '#fee2e2',
              color: '#991b1b',
              fontSize: 14,
            }}
          >
            {ocrError}
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Today's Timeline */}
      {todayMeasurements.length > 0 && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Hoje</h2>
          <div className={styles.timeline}>
            {todayMeasurements.map((m, i) => {
              const c = classifyBP(m.systolic, m.diastolic)
              const cc = classificationConfig[c]
              return (
                <div
                  key={m.id}
                  className={styles.timelineItem}
                  style={{ animationDelay: `${i * 0.05}s` }}
                >
                  <div className={styles.timelineDot} style={{ background: cc.color }} />
                  <div className={styles.timelineContent}>
                    <div className={styles.timelineBP}>
                      {m.systolic}/{m.diastolic}
                      <span className={styles.timelineUnit}> mmHg</span>
                    </div>
                    <div className={styles.timelineMeta}>
                      <span style={{ color: cc.color }}>{cc.label}</span>
                      {m.heartRate && <span> · {m.heartRate} bpm</span>}
                    </div>
                  </div>
                  <span className={styles.timelineTime}>
                    {new Date(m.measuredAt).toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Aparelho Bluetooth</h2>
        <BluetoothView />
      </div>

      <FloatingChat />
    </div>
  )
}

function formatRelativeTime(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'agora'
  if (minutes < 60) return `${minutes}min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h atrás`
  const days = Math.floor(hours / 24)
  return `${days}d atrás`
}
