import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useAuth, type CreatePatientProfileInput } from '../contexts/AuthContext'
import type { Patient, PlanStatus, UserRole } from '../models/types'
import { fetchManagedProfiles, type ManagedProfile } from '../services/railwayRepository'
import styles from './AdminProfilesView.module.css'

interface Props {
  onBack: () => void
}

interface FormState {
  name: string
  email: string
  password: string
  role: UserRole
  phone: string
  birthDate: string
  state: string
  operatorId: string
  comorbidities: string
  planStatus: PlanStatus
  inTreatmentPlan: boolean
}

const EMPTY_FORM: FormState = {
  name: '',
  email: '',
  password: '',
  role: 'patient',
  phone: '',
  birthDate: '',
  state: '',
  operatorId: '',
  comorbidities: '',
  planStatus: 'pendente',
  inTreatmentPlan: false,
}

function roleLabel(role: UserRole) {
  if (role === 'operator') return 'Médico'
  if (role === 'controller') return 'Gestora'
  return 'Paciente'
}

export default function AdminProfilesView({ onBack }: Props) {
  const { isAdmin, currentPatient, currentUserEmail, createPatientProfile, resetProfilePassword } = useAuth()
  const [profiles, setProfiles] = useState<ManagedProfile[]>([])
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [loadingProfiles, setLoadingProfiles] = useState(true)
  const [error, setError] = useState('')
  const [createdProfile, setCreatedProfile] = useState<Patient | null>(null)
  const [resetTarget, setResetTarget] = useState<ManagedProfile | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [newPasswordConfirmation, setNewPasswordConfirmation] = useState('')
  const [resetting, setResetting] = useState(false)
  const [resetNotice, setResetNotice] = useState('')

  const loadProfiles = useCallback(async () => {
    if (!currentPatient) return
    setLoadingProfiles(true)
    try {
      setProfiles(await fetchManagedProfiles())
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível carregar os acessos.')
    } finally {
      setLoadingProfiles(false)
    }
  }, [currentPatient])

  useEffect(() => {
    loadProfiles()
  }, [loadProfiles])

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((previous) => ({ ...previous, [key]: value }))
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setCreatedProfile(null)
    setSaving(true)

    const input: CreatePatientProfileInput = {
      name: form.name,
      email: form.email,
      password: form.password,
      role: form.role,
      phone: form.phone,
      birthDate: form.role === 'patient' ? form.birthDate : undefined,
      state: form.role === 'patient' ? form.state.trim().toUpperCase() : undefined,
      operatorId: form.role === 'patient' && currentPatient?.role === 'controller' ? form.operatorId || undefined : undefined,
      comorbidities:
        form.role === 'patient'
          ? form.comorbidities
              .split(',')
              .map((item) => item.trim())
              .filter(Boolean)
          : undefined,
      planStatus: form.role === 'patient' ? form.planStatus : undefined,
      inTreatmentPlan: form.role === 'patient' ? form.inTreatmentPlan : undefined,
    }

    try {
      const profile = await createPatientProfile(input)
      setCreatedProfile(profile)
      setForm(EMPTY_FORM)
      await loadProfiles()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível criar o perfil.')
    } finally {
      setSaving(false)
    }
  }

  const handlePasswordReset = async (event: FormEvent) => {
    event.preventDefault()
    if (!resetTarget) return
    setError('')
    setResetNotice('')
    if (newPassword.length < 12 || !/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) {
      return setError('A senha provisória deve ter ao menos 12 caracteres, combinando letras e números.')
    }
    if (newPassword !== newPasswordConfirmation) return setError('As senhas provisórias não coincidem.')
    setResetting(true)
    try {
      await resetProfilePassword(resetTarget.id, newPassword)
      setResetNotice(`Senha de ${resetTarget.name} redefinida. A troca será obrigatória no próximo acesso.`)
      setResetTarget(null)
      setNewPassword('')
      setNewPasswordConfirmation('')
      await loadProfiles()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível redefinir a senha.')
    } finally {
      setResetting(false)
    }
  }

  if (!isAdmin) {
    return (
      <main className={styles.container}>
        <section className={styles.denied}>
          <span className={styles.deniedIcon}>!</span>
          <h1>Acesso restrito</h1>
          <p>Esta área está disponível somente para o administrador do KPS Cardio.</p>
          <button className={styles.secondaryButton} onClick={onBack}>Voltar ao painel</button>
        </section>
      </main>
    )
  }

  return (
    <main className={styles.container}>
      <header className={styles.header}>
        <div>
          <button className={styles.backButton} onClick={onBack}>← Voltar ao painel</button>
          <p className={styles.eyebrow}>Administração protegida</p>
          <h1 className={styles.title}>Perfis de acesso</h1>
          <p className={styles.subtitle}>
            Crie acessos e redefina senhas provisórias para pacientes, médicos e gestoras.
          </p>
        </div>
        <div className={styles.adminBadge}>{currentUserEmail}</div>
      </header>

      <div className={styles.layout}>
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <p className={styles.cardEyebrow}>Novo cadastro</p>
              <h2>Adicionar perfil</h2>
            </div>
            <span className={styles.cardIcon}>+</span>
          </div>

          <p className={styles.notice}>
            A senha definida aqui é provisória e deverá ser substituída pelo usuário no primeiro acesso.
          </p>

          <form className={styles.form} onSubmit={handleSubmit}>
            <label className={styles.field}>
              <span>Nome completo *</span>
              <input
                value={form.name}
                onChange={(event) => updateField('name', event.target.value)}
                placeholder="Nome do paciente"
                autoComplete="name"
                required
              />
            </label>

            <div className={styles.formGrid}>
              <label className={styles.field}>
                <span>E-mail de acesso *</span>
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) => updateField('email', event.target.value)}
                  placeholder="paciente@email.com"
                  autoComplete="email"
                  required
                />
              </label>
              <label className={styles.field}>
                <span>Senha inicial *</span>
                <input
                  type="password"
                  value={form.password}
                  onChange={(event) => updateField('password', event.target.value)}
                  placeholder="Mínimo de 12 caracteres"
                  autoComplete="new-password"
                  minLength={12}
                  required
                />
              </label>
            </div>

            <div className={styles.formGrid}>
              <label className={styles.field}>
                <span>Tipo de perfil *</span>
                <select
                  value={form.role}
                  onChange={(event) => updateField('role', event.target.value as UserRole)}
                >
                  <option value="patient">Paciente</option>
                  {currentPatient?.role === 'controller' && <option value="operator">Médico</option>}
                </select>
              </label>
              <label className={styles.field}>
                <span>Telefone</span>
                <input
                  value={form.phone}
                  onChange={(event) => updateField('phone', event.target.value)}
                  placeholder="(11) 99999-9999"
                  autoComplete="tel"
                />
              </label>
            </div>

            {form.role === 'patient' && (
              <>
                <label className={styles.field}>
                  <span>Data de nascimento</span>
                  <input
                    type="date"
                    value={form.birthDate}
                    onChange={(event) => updateField('birthDate', event.target.value)}
                  />
                </label>
                <label className={styles.field}>
                  <span>UF</span>
                  <input
                    value={form.state}
                    onChange={(event) => updateField('state', event.target.value.toUpperCase().slice(0, 2))}
                    placeholder="SP"
                    maxLength={2}
                  />
                </label>
                {currentPatient?.role === 'controller' && (
                  <label className={styles.field}>
                    <span>Médico responsável</span>
                    <select value={form.operatorId} onChange={(event) => updateField('operatorId', event.target.value)}>
                      <option value="">Sem médico definido</option>
                      {profiles.filter((profile) => profile.role === 'operator').map((profile) => (
                        <option key={profile.id} value={profile.id}>{profile.name}</option>
                      ))}
                    </select>
                  </label>
                )}
                <label className={styles.field}>
                  <span>Comorbidades</span>
                  <input
                    value={form.comorbidities}
                    onChange={(event) => updateField('comorbidities', event.target.value)}
                    placeholder="Hipertensão, diabetes..."
                  />
                  <small>Separe mais de uma por vírgula.</small>
                </label>

                <div className={styles.formGrid}>
                  <label className={styles.field}>
                    <span>Status do plano</span>
                    <select
                      value={form.planStatus}
                      onChange={(event) => updateField('planStatus', event.target.value as PlanStatus)}
                    >
                      <option value="pendente">Pendente</option>
                      <option value="adimplente">Adimplente</option>
                      <option value="inadimplente">Inadimplente</option>
                    </select>
                  </label>
                  <label className={styles.checkField}>
                    <input
                      type="checkbox"
                      checked={form.inTreatmentPlan}
                      onChange={(event) => updateField('inTreatmentPlan', event.target.checked)}
                    />
                    <span>Incluir em plano de tratamento</span>
                  </label>
                </div>
              </>
            )}

            {form.role !== 'patient' && (
              <div className={styles.roleHint}>
                Este acesso será criado como <strong>{roleLabel(form.role).toLowerCase()}</strong>.
              </div>
            )}

            {error && <div className={styles.error}>{error}</div>}
            {createdProfile && (
              <div className={styles.success}>
                Perfil de <strong>{createdProfile.name}</strong> criado. O acesso é <strong>{createdProfile.email}</strong>.
              </div>
            )}

            <button className={styles.primaryButton} type="submit" disabled={saving}>
              {saving ? 'Criando perfil...' : `Criar perfil de ${roleLabel(form.role).toLowerCase()}`}
            </button>
          </form>
        </section>

        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <p className={styles.cardEyebrow}>Base atual</p>
              <h2>Perfis cadastrados</h2>
            </div>
            <span className={styles.count}>{profiles.length}</span>
          </div>

          {loadingProfiles ? (
            <div className={styles.loading}>Carregando perfis...</div>
          ) : profiles.length === 0 ? (
            <div className={styles.empty}>Nenhum perfil cadastrado ainda.</div>
          ) : (
            <div className={styles.profileList}>
              {profiles.map((profile) => (
                <article className={styles.profile} key={profile.id}>
                  <span className={styles.avatar}>{profile.name.charAt(0).toUpperCase()}</span>
                  <div className={styles.profileMain}>
                    <strong>{profile.name}</strong>
                    <span>{profile.email ?? 'E-mail não informado'}</span>
                    {profile.phone && <small>{profile.phone}</small>}
                  </div>
                  <div className={styles.profileActions}>
                    <span className={styles.profileStatus}>{roleLabel(profile.role)}</span>
                    <button
                      className={styles.passwordButton}
                      type="button"
                      onClick={() => {
                        setResetTarget(profile)
                        setNewPassword('')
                        setNewPasswordConfirmation('')
                        setResetNotice('')
                        setError('')
                      }}
                    >
                      Mudar senha
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}

          {resetNotice && <div className={styles.success}>{resetNotice}</div>}

          {resetTarget && (
            <form className={styles.resetForm} onSubmit={handlePasswordReset}>
              <div className={styles.resetHeader}>
                <div>
                  <strong>Nova senha provisória</strong>
                  <span>{resetTarget.name} · {resetTarget.email}</span>
                </div>
                <button type="button" onClick={() => setResetTarget(null)} aria-label="Cancelar redefinição">×</button>
              </div>
              <label className={styles.field}>
                <span>Senha provisória *</span>
                <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" minLength={12} required />
                <small>Mínimo de 12 caracteres, com letras e números.</small>
              </label>
              <label className={styles.field}>
                <span>Confirmar senha provisória *</span>
                <input type="password" value={newPasswordConfirmation} onChange={(event) => setNewPasswordConfirmation(event.target.value)} autoComplete="new-password" minLength={12} required />
              </label>
              {error && <div className={styles.error}>{error}</div>}
              <button className={styles.primaryButton} type="submit" disabled={resetting}>
                {resetting ? 'Redefinindo...' : 'Redefinir e encerrar sessões'}
              </button>
            </form>
          )}
        </section>
      </div>

      <p className={styles.footerNote}>
        O cadastro é criado no KPS Cardio e fica disponível, conforme as permissões, em qualquer dispositivo autorizado.
      </p>
    </main>
  )
}
