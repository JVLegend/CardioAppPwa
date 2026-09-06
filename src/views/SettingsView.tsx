import { useEffect, useId, useState, type FormEvent } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { getSyncState, onSyncStateChange, processPendingOperations, pullFromServer, retryFailedSyncOperations } from '../services/syncEngine'
import { isWebBluetoothSupported } from '../services/bluetoothService'
import { wipeAccountData } from '../services/database'
import { deleteRemoteAccount } from '../services/railwayRepository'
import DisclaimerView from './DisclaimerView'
import ReminderControls from './ReminderControls'
import DocumentSheetView from './DocumentSheetView'
import { useModalAccessibility } from '../hooks/useModalAccessibility'
import { useBlockingActivity } from '../services/activityState'
import AppPageHeader from './AppPageHeader'
import {
  PrivacyContent,
  TermsContent,
  SupportContent,
  PRIVACY_SUBTITLE,
  TERMS_SUBTITLE,
} from './legalContent'
import styles from './SettingsView.module.css'

type LegalDoc = 'privacy' | 'terms' | 'support'
const APP_VERSION = import.meta.env.VITE_APP_VERSION || '1.0.0'

export default function SettingsView() {
  const { logout, currentPatient, updatePassword } = useAuth()
  const [showDisclaimer, setShowDisclaimer] = useState(false)
  const [legalDoc, setLegalDoc] = useState<LegalDoc | null>(null)
  const [deleteStep, setDeleteStep] = useState<0 | 1 | 2>(0)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [syncState, setSyncState] = useState(getSyncState)
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [passwordNotice, setPasswordNotice] = useState('')

  useBlockingActivity('settings-password', showPasswordForm || passwordSaving)

  useEffect(() => onSyncStateChange(setSyncState), [])

  const retrySync = () => {
    void (syncState.failed > 0 ? retryFailedSyncOperations() : processPendingOperations())
      .then(() => pullFromServer())
  }

  const handlePasswordChange = async (event: FormEvent) => {
    event.preventDefault()
    setPasswordError('')
    setPasswordNotice('')
    if (newPassword.length < 12 || !/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) {
      setPasswordError('A senha deve ter ao menos 12 caracteres, combinando letras e números.')
      return
    }
    if (newPassword !== passwordConfirmation) {
      setPasswordError('As senhas novas não coincidem.')
      return
    }
    setPasswordSaving(true)
    try {
      await updatePassword(newPassword, currentPassword)
      setCurrentPassword('')
      setNewPassword('')
      setPasswordConfirmation('')
      setShowPasswordForm(false)
      setPasswordNotice('Senha atualizada com sucesso.')
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : 'Não foi possível atualizar a senha.')
    } finally {
      setPasswordSaving(false)
    }
  }

  const lastSyncLabel = syncState.lastSyncedAt
    ? new Date(syncState.lastSyncedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
    : 'Ainda não sincronizada nesta sessão'

  const handleDeleteAccount = async () => {
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteRemoteAccount()
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

  return (
    <div className={styles.container}>
      <AppPageHeader
        title="Ajustes"
        subtitle="Preferências e conta"
        actions={<button className={styles.headerSignOut} onClick={logout}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Sair
        </button>}
      />

      {/* Reminders */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Lembretes</h2>
        <ReminderControls
          showTitle={false}
        />
      </div>

      {/* Status */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Status</h2>
        <div className={styles.group}>
          <div className={styles.row}>
            <span className={styles.rowLabel}>Bluetooth</span>
            <span className={styles.badge} style={{ color: isWebBluetoothSupported() ? 'var(--cardio-green)' : 'var(--text-muted)' }}>
              {isWebBluetoothSupported() ? 'Suportado' : 'Indisponível'}
            </span>
          </div>
          <div className={styles.divider} />
          <div className={styles.row}>
            <span className={styles.rowLabel}>Sincronização</span>
            <span className={styles.badge} style={{ color: syncState.status === 'idle' ? 'var(--cardio-green)' : syncState.status === 'syncing' ? 'var(--cardio-warm)' : 'var(--cardio-red)' }}>
              {syncState.status === 'offline' ? 'Offline' : syncState.status === 'syncing' ? 'Sincronizando…' : syncState.status === 'error' ? 'Atenção' : 'Atualizada'}
            </span>
          </div>
          <div className={styles.divider} />
          <div className={styles.row}>
            <span className={styles.rowLabel}>Última atualização</span>
            <span className={styles.rowValue}>{lastSyncLabel}</span>
          </div>
          {syncState.message && <div role="status" className={styles.syncMessage}>{syncState.message}</div>}
          {(syncState.pending > 0 || syncState.failed > 0 || syncState.message) && (
            <>
              <div className={styles.divider} />
              <button className={styles.linkRow} onClick={retrySync}>
                <span className={styles.rowLabel}>
                  {syncState.failed > 0
                    ? `${syncState.failed} alteração(ões) com falha`
                    : `${syncState.pending} alteração(ões) pendente(s)`}
                </span>
                <span className={styles.chevron}>{syncState.failed > 0 ? 'Reabrir tentativa' : 'Tentar novamente'}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* About */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Sobre</h2>
        <div className={styles.group}>
          <div className={styles.row}>
            <span className={styles.rowLabel}>Versão</span>
            <span className={styles.rowValue}>{APP_VERSION}</span>
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

      {/* Segurança */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Segurança</h2>
        <div className={styles.group}>
          {!showPasswordForm ? (
            <button
              className={styles.linkRow}
              onClick={() => { setPasswordError(''); setPasswordNotice(''); setShowPasswordForm(true) }}
            >
              <span className={styles.rowLabel}>Trocar senha</span>
              <span className={styles.chevron}>›</span>
            </button>
          ) : (
            <form className={styles.passwordForm} onSubmit={handlePasswordChange}>
              <p className={styles.rowDesc}>A senha deve ter ao menos 12 caracteres, com letras e números.</p>
              <label className={styles.passwordField}>
                <span>Senha atual</span>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  autoComplete="current-password"
                  required
                />
              </label>
              <label className={styles.passwordField}>
                <span>Nova senha</span>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  autoComplete="new-password"
                  minLength={12}
                  required
                />
              </label>
              <label className={styles.passwordField}>
                <span>Confirmar nova senha</span>
                <input
                  type="password"
                  value={passwordConfirmation}
                  onChange={(event) => setPasswordConfirmation(event.target.value)}
                  autoComplete="new-password"
                  minLength={12}
                  required
                />
              </label>
              {passwordError && <div className={styles.errorText} role="alert">{passwordError}</div>}
              {passwordNotice && <div className={styles.passwordNotice} role="status">{passwordNotice}</div>}
              <div className={styles.passwordActions}>
                <button
                  type="button"
                  className={styles.secondaryAction}
                  onClick={() => { setShowPasswordForm(false); setCurrentPassword(''); setNewPassword(''); setPasswordConfirmation('') }}
                  disabled={passwordSaving}
                >
                  Cancelar
                </button>
                <button type="submit" className={styles.primaryAction} disabled={passwordSaving}>
                  {passwordSaving ? 'Atualizando…' : 'Atualizar senha'}
                </button>
              </div>
            </form>
          )}
          {!showPasswordForm && passwordNotice && (
            <div className={styles.passwordNoticeStandalone} role="status">{passwordNotice}</div>
          )}
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
          <button className={styles.linkRow} onClick={() => setLegalDoc('privacy')}>
            <span className={styles.rowLabel}>Política de Privacidade</span>
            <span className={styles.chevron}>›</span>
          </button>
          <div className={styles.divider} />
          <button className={styles.linkRow} onClick={() => setLegalDoc('terms')}>
            <span className={styles.rowLabel}>Termos de Uso</span>
            <span className={styles.chevron}>›</span>
          </button>
          <div className={styles.divider} />
          <button className={styles.linkRow} onClick={() => setLegalDoc('support')}>
            <span className={styles.rowLabel}>Suporte</span>
            <span className={styles.chevron}>›</span>
          </button>
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

      {/* Modais de documentos legais e suporte */}
      {legalDoc === 'privacy' && (
        <DocumentSheetView
          title="Política de Privacidade"
          subtitle={PRIVACY_SUBTITLE}
          onClose={() => setLegalDoc(null)}
        >
          <PrivacyContent />
        </DocumentSheetView>
      )}
      {legalDoc === 'terms' && (
        <DocumentSheetView
          title="Termos de Uso"
          subtitle={TERMS_SUBTITLE}
          onClose={() => setLegalDoc(null)}
        >
          <TermsContent />
        </DocumentSheetView>
      )}
      {legalDoc === 'support' && (
        <DocumentSheetView
          title="Suporte"
          onClose={() => setLegalDoc(null)}
        >
          <SupportContent />
        </DocumentSheetView>
      )}

      {(deleteStep === 1 || deleteStep === 2) && (
        <AccountDeletionDialog
          key={deleteStep}
          step={deleteStep}
          deleting={deleting}
          onCancel={() => setDeleteStep(0)}
          onContinue={() => setDeleteStep(2)}
          onConfirm={() => void handleDeleteAccount()}
        />
      )}
    </div>
  )
}

function AccountDeletionDialog({
  step,
  deleting,
  onCancel,
  onContinue,
  onConfirm,
}: {
  step: 1 | 2
  deleting: boolean
  onCancel: () => void
  onContinue: () => void
  onConfirm: () => void
}) {
  const dialogRef = useModalAccessibility(() => {
    if (!deleting) onCancel()
  })
  const titleId = useId()
  const descriptionId = useId()
  const isFinalStep = step === 2

  return (
    <div className={styles.confirmOverlay} role="presentation">
      <div
        ref={dialogRef}
        className={styles.confirmCard}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
      >
        <h2 id={titleId}>{isFinalStep ? 'Confirmar exclusão' : 'Excluir minha conta?'}</h2>
        <p id={descriptionId}>
          {isFinalStep
            ? 'Se você tiver uma assinatura ativa, lembre-se de cancelá-la com sua operadora. Esta ação é definitiva.'
            : 'Isto apagará permanentemente seu cadastro, todas as medições, medicações, alertas e mensagens. A operação não pode ser desfeita.'}
        </p>
        <div className={styles.confirmRow}>
          <button className={styles.cancelBtn} onClick={onCancel} disabled={deleting}>
            Cancelar
          </button>
          {isFinalStep ? (
            <button className={styles.dangerBtn} onClick={onConfirm} disabled={deleting}>
              {deleting ? 'Excluindo...' : 'Excluir definitivamente'}
            </button>
          ) : (
            <button className={styles.dangerBtn} onClick={onContinue}>
              Continuar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
