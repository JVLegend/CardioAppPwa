import type { ReactNode } from 'react'
import styles from './AppPageHeader.module.css'

interface Props {
  title: string
  subtitle: string
  actions?: ReactNode
  inset?: boolean
  flush?: boolean
}

export default function AppPageHeader({ title, subtitle, actions, inset = false, flush = false }: Props) {
  return (
    <header className={`${styles.header} ${inset ? styles.inset : ''} ${flush ? styles.flush : ''}`}>
      <div className={styles.text}>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.subtitle}>{subtitle}</p>
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </header>
  )
}
