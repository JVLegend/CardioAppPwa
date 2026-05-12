import { useEffect, useState } from 'react'
import {
  getReminders,
  setReminder,
  onRemindersChange,
  ensureNotificationPermission,
  type ReminderKey,
  type ReminderConfig,
} from '../services/reminderService'
import styles from './ReminderControls.module.css'

const REMINDER_LABEL: Record<ReminderKey, string> = {
  pressao: 'Pressão',
  glicose: 'Glicose',
}

const REMINDER_DESC: Record<ReminderKey, string> = {
  pressao: 'Lembrar 1× ao dia',
  glicose: 'Lembrar 1× ao dia',
}

interface Props {
  /** Mostra um título no topo do card. Padrão = mostra. */
  showTitle?: boolean
  /** Texto do título. */
  title?: string
  /** Subtítulo opcional sob o título. */
  subtitle?: string
}

export default function ReminderControls({
  showTitle = true,
  title = 'Lembretes diários',
  subtitle = 'Receba uma notificação para registrar sua medição',
}: Props) {
  const [reminders, setReminders] = useState(getReminders())
  const [permError, setPermError] = useState('')

  useEffect(() => onRemindersChange(setReminders), [])

  const handleToggle = async (key: ReminderKey, next: boolean) => {
    setPermError('')
    if (next) {
      const ok = await ensureNotificationPermission()
      if (!ok) {
        setPermError(
          'Permissão de notificação negada. Habilite nas configurações do navegador.'
        )
        return
      }
    }
    setReminder(key, { enabled: next })
  }

  const setHour = (key: ReminderKey, hour: number) => {
    setReminder(key, { hour: Math.max(0, Math.min(23, hour)) })
  }

  return (
    <div className={styles.card}>
      {showTitle && (
        <div className={styles.header}>
          <h2 className={styles.title}>{title}</h2>
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        </div>
      )}

      {(['pressao', 'glicose'] as ReminderKey[]).map((key, i) => (
        <ReminderRow
          key={key}
          rkey={key}
          config={reminders[key]}
          onToggle={(v) => handleToggle(key, v)}
          onHourChange={(h) => setHour(key, h)}
          isFirst={i === 0}
        />
      ))}

      {permError && <div className={styles.error}>{permError}</div>}
    </div>
  )
}

function ReminderRow({
  rkey,
  config,
  onToggle,
  onHourChange,
  isFirst,
}: {
  rkey: ReminderKey
  config: ReminderConfig
  onToggle: (v: boolean) => void
  onHourChange: (h: number) => void
  isFirst: boolean
}) {
  return (
    <div className={`${styles.block} ${isFirst ? '' : styles.blockSep}`}>
      <div className={styles.row}>
        <div className={styles.rowText}>
          <span className={styles.rowLabel}>{REMINDER_LABEL[rkey]}</span>
          <span className={styles.rowDesc}>{REMINDER_DESC[rkey]}</span>
        </div>
        <button
          className={`${styles.toggle} ${config.enabled ? styles.toggleOn : ''}`}
          onClick={() => onToggle(!config.enabled)}
          aria-label={`Lembrete de ${REMINDER_LABEL[rkey]}`}
        >
          <span className={styles.toggleKnob} />
        </button>
      </div>
      {config.enabled && (
        <div className={styles.row}>
          <span className={styles.rowLabelMuted}>Horário</span>
          <div className={styles.stepper}>
            <button
              className={styles.stepBtn}
              onClick={() => onHourChange(config.hour - 1)}
              aria-label="Diminuir horário"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
            <span className={styles.stepValue}>
              {String(config.hour).padStart(2, '0')}:00
            </span>
            <button
              className={styles.stepBtn}
              onClick={() => onHourChange(config.hour + 1)}
              aria-label="Aumentar horário"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
