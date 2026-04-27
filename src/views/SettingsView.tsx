import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { requestNotificationPermission } from '../services/alertService'
import { getIsOnline } from '../services/syncEngine'
import { isWebBluetoothSupported } from '../services/bluetoothService'
import { wipeAccountData } from '../services/database'
import DisclaimerView from './DisclaimerView'
import styles from './SettingsView.module.css'

export default function SettingsView() {
  const { logout, currentPatient } = useAuth()
  const [reminderEnabled, setReminderEnabled] = useState(false)
  const [reminderHour, setReminderHour] = useState(8)
  const [showDisclaimer, setShowDisclaimer] = useState(false)
  const [deleteStep, setDeleteStep] = useState<0 | 1 | 2>(0)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const handleDeleteAccount = async () => {
    setDeleting(true)
    setDeleteError(null)
    try {
      await wipeAccountData()
      // logout clears in-memory state e leva pra LoginView. localStorage já
      // foi limpo dentro de wipeAccountData (incluindo o disclaimer flag).
      await logout()
      window.location.reload()
    } catch (e) {
      setDeleteError('Não foi possível excluir a conta. Tente novamente.')
      setDeleting(false)
    }
  }

  const handleToggleReminder = async () => {
    if (!reminderEnabled) {
      const granted = await requestNotificationPermission()
      if (!granted) return
    }
    setReminderEnabled(!reminderEnabled)
  }

  return (
    <div className={styles.container}>
      <div className={styles.titleBar}>
        <h1 className={styles.title}>Ajustes</h1>
        <button className={styles.headerSignOut} onClick={logout}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Sair
        </button>
      </div>

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

      {/* Legal & Suporte */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Legal & Suporte</h2>
        <div className={styles.group}>
          <button className={styles.linkRow} onClick={() => setShowDisclaimer(true)}>
            <span className={styles.rowLabel}>Aviso médico</span>
            <span className={styles.chevron}>›</span>
          </button>
          <div className={styles.divider} />
          <a className={styles.linkRow} href="/privacy.html" target="_blank" rel="noreferrer">
            <span className={styles.rowLabel}>Política de Privacidade</span>
            <span className={styles.chevron}>›</span>
          </a>
          <div className={styles.divider} />
          <a className={styles.linkRow} href="/terms.html" target="_blank" rel="noreferrer">
            <span className={styles.rowLabel}>Termos de Uso</span>
            <span className={styles.chevron}>›</span>
          </a>
          <div className={styles.divider} />
          <a className={styles.linkRow} href="/support.html" target="_blank" rel="noreferrer">
            <span className={styles.rowLabel}>Suporte</span>
            <span className={styles.chevron}>›</span>
          </a>
        </div>
      </div>

      {/* Conta */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Conta</h2>
        <button className={styles.signOutBtn} onClick={logout}>
          Sair
        </button>
        <button
          className={styles.deleteBtn}
          onClick={() => setDeleteStep(1)}
        >
          Excluir minha conta
        </button>
        {deleteError && <div className={styles.errorText}>{deleteError}</div>}
      </div>

      {/* Modal: aviso médico reabrível */}
      {showDisclaimer && (
        <DisclaimerView variant="modal" onClose={() => setShowDisclaimer(false)} />
      )}

      {/* Confirmação 1/2 */}
      {deleteStep === 1 && (
        <div className={styles.confirmOverlay}>
          <div className={styles.confirmCard}>
            <h3>Excluir minha conta?</h3>
            <p>
              Isto apagará permanentemente seu cadastro, todas as medições,
              medicações, alertas e mensagens. A operação não pode ser desfeita.
            </p>
            <div className={styles.confirmRow}>
              <button className={styles.cancelBtn} onClick={() => setDeleteStep(0)}>
                Cancelar
              </button>
              <button className={styles.dangerBtn} onClick={() => setDeleteStep(2)}>
                Continuar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmação 2/2 */}
      {deleteStep === 2 && (
        <div className={styles.confirmOverlay}>
          <div className={styles.confirmCard}>
            <h3>Confirmar exclusão</h3>
            <p>
              Se você tiver uma assinatura ativa, lembre-se de cancelá-la com
              sua operadora. Esta ação é definitiva.
            </p>
            <div className={styles.confirmRow}>
              <button
                className={styles.cancelBtn}
                onClick={() => setDeleteStep(0)}
                disabled={deleting}
              >
                Cancelar
              </button>
              <button
                className={styles.dangerBtn}
                onClick={handleDeleteAccount}
                disabled={deleting}
              >
                {deleting ? 'Excluindo...' : 'Excluir definitivamente'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
