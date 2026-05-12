import type { ReactNode } from 'react'
import styles from './DocumentSheetView.module.css'

interface Props {
  title: string
  subtitle?: string
  onClose: () => void
  children: ReactNode
}

/** Sheet modal genérico para conteúdos textuais (privacidade, termos, suporte). */
export default function DocumentSheetView({ title, subtitle, onClose, children }: Props) {
  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" onClick={onClose}>
      <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
        <header className={styles.header}>
          <div>
            <h1 className={styles.title}>{title}</h1>
            {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Fechar">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </header>
        <div className={styles.body}>{children}</div>
        <footer className={styles.footer}>
          <button className={styles.primaryBtn} onClick={onClose}>Entendi</button>
        </footer>
      </div>
    </div>
  )
}
