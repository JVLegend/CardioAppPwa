import { useState, useEffect } from 'react'
import ChatView from './ChatView'
import { fetchChatMessages } from '../services/database'
import { useAuth } from '../contexts/AuthContext'
import styles from './FloatingChat.module.css'

/**
 * Botão flutuante estilo WhatsApp na Home do paciente.
 * Minimizado: bolha verde no canto inferior direito (com badge de mensagens não lidas).
 * Expandido: abre o ChatView dentro de uma "janela" sobreposta.
 */
export default function FloatingChat() {
  const { currentPatient } = useAuth()
  const [open, setOpen] = useState(false)
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    if (!currentPatient) return
    let cancelled = false
    const tick = async () => {
      const operatorId = currentPatient.operatorId || currentPatient.id
      const msgs = await fetchChatMessages(operatorId, currentPatient.id)
      if (cancelled) return
      const fromOther = currentPatient.role === 'patient' ? 'operator' : 'patient'
      setUnread(msgs.filter((m) => !m.read && m.fromRole === fromOther).length)
    }
    tick()
    const id = setInterval(tick, 5000)
    return () => { cancelled = true; clearInterval(id) }
  }, [currentPatient, open])

  if (!currentPatient) return null

  if (open) {
    return (
      <div className={styles.window}>
        <div className={styles.windowHeader}>
          <span>Chat com sua equipe</span>
          <button className={styles.closeBtn} onClick={() => setOpen(false)} aria-label="Minimizar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>
        <div className={styles.windowBody}>
          <ChatView />
        </div>
      </div>
    )
  }

  return (
    <button className={styles.fab} onClick={() => setOpen(true)} aria-label="Abrir chat">
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
           stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
      </svg>
      {unread > 0 && <span className={styles.badge}>{unread > 9 ? '9+' : unread}</span>}
    </button>
  )
}
