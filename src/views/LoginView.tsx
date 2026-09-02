import { useState, type FormEvent } from 'react'
import { useAuth } from '../contexts/AuthContext'
import KardiaLogo from './KardiaLogo'
import styles from './LoginView.module.css'

export default function LoginView() {
  const {
    login, updatePassword, clearError, isLoading, mustChangePassword,
    currentUserEmail, errorMessage,
  } = useAuth()
  const [showHelp, setShowHelp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [localError, setLocalError] = useState('')

  const handleLogin = (event: FormEvent) => {
    event.preventDefault()
    if (email && password) void login(email, password)
  }

  const handlePasswordUpdate = async (event: FormEvent) => {
    event.preventDefault()
    setLocalError('')
    if (password.length < 12 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      return setLocalError('Use pelo menos 12 caracteres, combinando letras e números.')
    }
    if (password !== passwordConfirmation) return setLocalError('As senhas não coincidem.')
    try { await updatePassword(password) } catch { /* mensagem fornecida pelo contexto */ }
  }

  const showError = localError || errorMessage

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.logoRing}><KardiaLogo size={88} variant="mark" /></div>
        <h1 className={styles.title}>{mustChangePassword ? 'Crie sua senha' : 'KPS Cardio'}</h1>
        <p className={styles.subtitle}>
          {mustChangePassword
            ? `Primeiro acesso${currentUserEmail ? ` de ${currentUserEmail}` : ''}`
            : 'Monitoramento cardiovascular'}
        </p>
      </div>

      {mustChangePassword ? (
        <form className={styles.form} onSubmit={handlePasswordUpdate}>
          <div className={styles.notice} role="status">
            Por segurança, substitua a senha provisória antes de continuar.
          </div>
          {showError && <div className={styles.error} role="alert">{showError}</div>}
          <div className={styles.inputGroup}>
            <input className={styles.input} type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Nova senha" autoComplete="new-password" minLength={12} required />
            <div className={styles.inputDivider} />
            <input className={styles.input} type="password" value={passwordConfirmation} onChange={(event) => setPasswordConfirmation(event.target.value)} placeholder="Confirme a nova senha" autoComplete="new-password" minLength={12} required />
          </div>
          <p className={styles.passwordHint}>Mínimo de 12 caracteres, com letras e números.</p>
          <button className={styles.button} type="submit" disabled={isLoading}>{isLoading ? 'Salvando…' : 'Salvar e entrar'}</button>
        </form>
      ) : showHelp ? (
        <section className={styles.form} aria-labelledby="access-help-title">
          <div className={styles.helpCard}>
            <h2 id="access-help-title">Recuperar acesso</h2>
            <p>Solicite ao administrador do KPS Cardio uma senha provisória. No próximo acesso, você criará uma senha pessoal.</p>
          </div>
          <button className={styles.linkButton} type="button" onClick={() => { setShowHelp(false); setLocalError(''); clearError() }}>Voltar ao login</button>
        </section>
      ) : (
        <form className={styles.form} onSubmit={handleLogin}>
          {showError && <div className={styles.error} role="alert">{showError}</div>}
          <div className={styles.inputGroup}>
            <input className={styles.input} type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="E-mail" autoComplete="email" required />
            <div className={styles.inputDivider} />
            <input className={styles.input} type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Senha" autoComplete="current-password" required />
          </div>
          <button className={styles.button} type="submit" disabled={isLoading}>{isLoading ? 'Entrando…' : 'Entrar'}</button>
          <button className={styles.linkButton} type="button" onClick={() => { setShowHelp(true); setLocalError(''); clearError() }}>Esqueci minha senha</button>
        </form>
      )}

      <p className={styles.footer}>Cuidado com o seu coração todos os dias</p>
    </div>
  )
}
