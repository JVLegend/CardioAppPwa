import { useState, type FormEvent } from 'react'
import { useAuth } from '../contexts/AuthContext'
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
          <svg viewBox="0 0 48 48" className={styles.logoSvg}>
            <path
              d="M24 8C18 8 14 12 14 16c0 8 10 20 10 20s10-12 10-20c0-4-4-8-10-8z"
              fill="var(--cardio-red)"
            />
          </svg>
        </div>
        <h1 className={styles.title}>CardioApp</h1>
        <p className={styles.subtitle}>Monitoramento Inteligente</p>
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
        Pressão arterial sob controle
      </p>
    </div>
  )
}
