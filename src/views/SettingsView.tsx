import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { requestNotificationPermission } from '../services/alertService'
import { getIsOnline } from '../services/syncEngine'
import { isWebBluetoothSupported } from '../services/bluetoothService'
import styles from './SettingsView.module.css'

export default function SettingsView() {
  const { logout, currentPatient } = useAuth()
  const [reminderEnabled, setReminderEnabled] = useState(false)
  const [reminderHour, setReminderHour] = useState(8)

  const handleToggleReminder = async () => {
    if (!reminderEnabled) {
      const granted = await requestNotificationPermission()
      if (!granted) return
    }
    setReminderEnabled(!reminderEnabled)
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Ajustes</h1>

      {/* Reminders */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Lembretes</h2>
        <div className={styles.group}>
          <div className={styles.row}>
            <div className={styles.rowText}>
              <span className={styles.rowLabel}>Lembrete diario</span>
              <span className={styles.rowDesc}>Notificacao para medir</span>
            </div>
            <button
              className={`${styles.toggle} ${reminderEnabled ? styles.toggleOn : ''}`}
              onClick={handleToggleReminder}
            >
              <span className={styles.toggleKnob} />
            </button>
          </div>
          {reminderEnabled && (
            <>
              <div className={styles.divider} />
              <div className={styles.row}>
                <span className={styles.rowLabel}>Horario</span>
                <div className={styles.stepper}>
                  <button className={styles.stepBtn} onClick={() => setReminderHour(Math.max(5, reminderHour - 1))}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--cardio-red)" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  </button>
                  <span className={styles.stepValue}>{String(reminderHour).padStart(2, '0')}:00</span>
                  <button className={styles.stepBtn} onClick={() => setReminderHour(Math.min(22, reminderHour + 1))}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--cardio-red)" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Status */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Status</h2>
        <div className={styles.group}>
          <div className={styles.row}>
            <span className={styles.rowLabel}>Bluetooth</span>
            <span className={styles.badge} style={{ color: isWebBluetoothSupported() ? 'var(--cardio-green)' : 'var(--text-muted)' }}>
              {isWebBluetoothSupported() ? 'Suportado' : 'Indisponivel'}
            </span>
          </div>
          <div className={styles.divider} />
          <div className={styles.row}>
            <span className={styles.rowLabel}>Conexao</span>
            <span className={styles.badge} style={{ color: getIsOnline() ? 'var(--cardio-green)' : 'var(--cardio-red)' }}>
              {getIsOnline() ? 'Online' : 'Offline'}
            </span>
          </div>
        </div>
      </div>

      {/* About */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Sobre</h2>
        <div className={styles.group}>
          <div className={styles.row}>
            <span className={styles.rowLabel}>Versao</span>
            <span className={styles.rowValue}>1.0.0</span>
          </div>
          <div className={styles.divider} />
          <div className={styles.row}>
            <span className={styles.rowLabel}>Paciente</span>
            <span className={styles.rowValue}>{currentPatient?.name || '—'}</span>
          </div>
          <div className={styles.divider} />
          <div className={styles.row}>
            <span className={styles.rowLabel}>Tipo</span>
            <span className={styles.rowValue}>Progressive Web App</span>
          </div>
        </div>
      </div>

      <button className={styles.signOutBtn} onClick={logout}>
        Sair
      </button>
    </div>
  )
}
