import { useState, type FormEvent } from 'react'
import { useAuth } from '../contexts/AuthContext'
import styles from './LoginView.module.css'

export default function LoginView() {
  const { login, isLoading, errorMessage } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (email && password) login(email, password)
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.icon}>❤️</div>
        <h1 className={styles.title}>CardioApp</h1>
        <p className={styles.subtitle}>Monitoramento de Pressão Arterial</p>
      </div>

      <form className={styles.form} onSubmit={handleSubmit}>
        {errorMessage && <div className={styles.error}>{errorMessage}</div>}

        <div className={styles.field}>
          <label className={styles.label}>Email</label>
          <input
            className={styles.input}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="seu@email.com"
            autoComplete="email"
            required
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Senha</label>
          <input
            className={styles.input}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            required
          />
        </div>

        <button className={styles.button} type="submit" disabled={isLoading}>
          {isLoading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}
