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
      <h1 className={styles.title}>Configuracoes</h1>

      {/* Reminders */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Lembretes</h2>
        <div className={styles.card}>
          <div className={styles.settingRow}>
            <div>
              <div className={styles.settingLabel}>Lembrete Diario</div>
              <div className={styles.settingDesc}>
                Notificacao para medir pressao
              </div>
            </div>
            <button
              className={`${styles.toggle} ${reminderEnabled ? styles.toggleOn : ''}`}
              onClick={handleToggleReminder}
            >
              <span className={styles.toggleKnob} />
            </button>
          </div>
          {reminderEnabled && (
            <div className={styles.settingRow} style={{ marginTop: 12 }}>
              <span className={styles.settingLabel}>Horario</span>
              <div className={styles.hourPicker}>
                <button
                  className={styles.hourBtn}
                  onClick={() => setReminderHour(Math.max(5, reminderHour - 1))}
                >
                  -
                </button>
                <span className={styles.hourValue}>{reminderHour}:00</span>
                <button
                  className={styles.hourBtn}
                  onClick={() => setReminderHour(Math.min(22, reminderHour + 1))}
                >
                  +
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Device */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Aparelho</h2>
        <div className={styles.card}>
          <div className={styles.settingRow}>
            <span className={styles.settingLabel}>Web Bluetooth</span>
            <span
              className={styles.statusBadge}
              style={{
                background: isWebBluetoothSupported()
                  ? 'var(--cardio-green)'
                  : 'var(--cardio-orange)',
              }}
            >
              {isWebBluetoothSupported() ? 'Suportado' : 'Nao suportado'}
            </span>
          </div>
          <div className={styles.settingRow} style={{ marginTop: 8 }}>
            <span className={styles.settingLabel}>Conexao</span>
            <span
              className={styles.statusBadge}
              style={{
                background: getIsOnline()
                  ? 'var(--cardio-green)'
                  : 'var(--cardio-red)',
              }}
            >
              {getIsOnline() ? 'Online' : 'Offline'}
            </span>
          </div>
        </div>
      </div>

      {/* About */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Sobre</h2>
        <div className={styles.card}>
          <div className={styles.aboutRow}>
            <span className={styles.settingLabel}>Versao</span>
            <span className={styles.settingDesc}>1.0.0 (PWA)</span>
          </div>
          <div className={styles.aboutRow}>
            <span className={styles.settingLabel}>Paciente</span>
            <span className={styles.settingDesc}>
              {currentPatient?.name || '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Sign Out */}
      <button className={styles.signOutBtn} onClick={logout}>
        Sair
      </button>
    </div>
  )
}
