import { useState, type FormEvent } from 'react'
import { useAuth } from '../contexts/AuthContext'
import KardiaLogo from './KardiaLogo'
import styles from './LoginView.module.css'

export default function LoginView() {
  const { login, isLoading, errorMessage } = useAuth()
  const [email, setEmail] = useState('kneipapps@gmail.com')
  const [password, setPassword] = useState('Phygital')

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (email && password) login(email, password)
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.logoRing}>
          <KardiaLogo size={88} variant="mark" />
        </div>
        <h1 className={styles.title}>KPS Cardio</h1>
        <p className={styles.subtitle}>Monitoramento cardiovascular</p>
      </div>

      <form className={styles.form} onSubmit={handleSubmit}>
        {errorMessage && <div className={styles.error}>{errorMessage}</div>}

        <div className={styles.inputGroup}>
          <input
            className={styles.input}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            autoComplete="email"
            required
          />
          <div className={styles.inputDivider} />
          <input
            className={styles.input}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Senha"
            autoComplete="current-password"
            required
          />
        </div>

        <button className={styles.button} type="submit" disabled={isLoading}>
          {isLoading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>

      <p className={styles.footer}>
        Cuidado com o seu coração todos os dias
      </p>
    </div>
  )
}
