import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import type { ChatMessage } from '../models/types'
import * as db from '../services/database'
import { getIsOnline, onSyncStateChange, persistEntity, pullFromServer } from '../services/syncEngine'
import { markChatReadRemote } from '../services/railwayRepository'
import { clearDraft, readDraft, writeDraft } from '../services/draftStorage'
import AppPageHeader from './AppPageHeader'
import styles from './ChatView.module.css'

export default function ChatView() {
  const { currentPatient, currentUserRole } = useAuth()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')
  const [online, setOnline] = useState(getIsOnline())
  const bottomRef = useRef<HTMLDivElement>(null)
  const loadingRef = useRef(false)

  const operatorId = currentPatient?.operatorId ?? ''
  const patientId = currentPatient?.id ?? ''
  const draftScope = operatorId && patientId ? `chat:${operatorId}:${patientId}` : ''
  // currentPatient pode ser o prontuário selecionado pelo médico. A autoria
  // precisa vir da sessão autenticada, e não do paciente em foco.
  const isOperator = currentUserRole === 'operator'

  useEffect(() => {
    if (!draftScope) {
      setInput('')
      return
    }
    const draft = readDraft<{ input?: string }>(draftScope)
    setInput(draft?.input ?? '')
  }, [draftScope])

  useEffect(() => {
    if (!draftScope) return
    const timer = window.setTimeout(() => {
      if (input.trim()) writeDraft(draftScope, { input })
      else clearDraft(draftScope)
    }, 250)
    return () => window.clearTimeout(timer)
  }, [draftScope, input])

  useEffect(() => {
    return onSyncStateChange((next) => setOnline(next.status !== 'offline'))
  }, [])

  const loadMessages = useCallback(async () => {
    if (!operatorId || !patientId || loadingRef.current) return
    loadingRef.current = true
    try {
      await pullFromServer()
      const msgs = await db.fetchChatMessages(operatorId, patientId)
      const readerRole = isOperator ? 'operator' : 'patient'
      const unread = msgs.filter((message) => message.fromRole !== readerRole && !message.read)
      if (unread.length > 0) {
        try {
          await markChatReadRemote(patientId)
          await db.markMessagesRead(operatorId, patientId, readerRole)
        } catch (error) {
          // Sem rede, cada leitura vira uma operação idempotente da fila. A
          // conversa continua correta neste aparelho e o servidor converge
          // quando a conexão voltar.
          await Promise.allSettled(unread.map((message) => {
            const readMessage = { ...message, read: true }
            return persistEntity('chatMessage', message.id, 'update', readMessage, () => db.saveChatMessage(readMessage))
          }))
          console.warn('[chat] leitura será sincronizada depois', error)
        }
      }
      setMessages(msgs.map((message) => unread.some((item) => item.id === message.id)
        ? { ...message, read: true }
        : message))
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    } catch (error) {
      console.warn('[chat] não foi possível atualizar as mensagens', error)
    } finally {
      loadingRef.current = false
    }
  }, [isOperator, operatorId, patientId])

  useEffect(() => {
    if (!operatorId || !patientId) return
    void loadMessages()
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void loadMessages()
    }, 5000)
    const onVisible = () => { if (document.visibilityState === 'visible') void loadMessages() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [loadMessages, operatorId, patientId])

  const handleSend = async () => {
    if (!input.trim() || sending) return
    setSending(true)
    setSendError('')
    const content = input.trim()
    const msg: ChatMessage = {
      id: crypto.randomUUID(),
      operatorId,
      patientId,
      fromRole: isOperator ? 'operator' : 'patient',
      content,
      sentAt: new Date().toISOString(),
      read: false,
    }
    try {
      await persistEntity('chatMessage', msg.id, 'create', msg, () => db.saveChatMessage(msg))
      setMessages((prev) => [...prev.filter((item) => item.id !== msg.id), msg])
      setInput('')
      clearDraft(draftScope)
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    } catch (error) {
      console.error('[chat] falha ao enviar mensagem', error)
      setSendError(error instanceof Error ? error.message : 'Não foi possível enviar. Tente novamente.')
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const grouped = groupMessagesByDate(messages)

  if (!operatorId || !patientId) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyIcon}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--cardio-red)" strokeWidth="1.5" strokeLinecap="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>
        </div>
        <p className={styles.emptyTitle}>Chat indisponível</p>
        <p className={styles.emptyDesc}>Selecione um paciente para conversar</p>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <AppPageHeader
        title="Chat"
        subtitle={isOperator
          ? `Paciente selecionado · ${online ? 'atualiza automaticamente' : 'offline'}`
          : `Minha equipe · ${online ? 'atualiza automaticamente' : 'offline'}`}
        inset
        flush
        actions={<div className={styles.headerAvatar}>
          {isOperator ? 'P' : 'M'}
        </div>}
      />

      {/* Messages */}
      <div className={styles.messages}>
        {grouped.length === 0 ? (
          <div className={styles.noMessages}>
            <div className={styles.noMessagesIcon}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>
            </div>
            <p>Nenhuma mensagem ainda</p>
            <p>Inicie a conversa!</p>
          </div>
        ) : (
          grouped.map(({ dateLabel, msgs }) => (
            <div key={dateLabel}>
              <div className={styles.dateSeparator}>
                <span>{dateLabel}</span>
              </div>
              {msgs.map((msg) => {
                const isMe = (isOperator && msg.fromRole === 'operator') || (!isOperator && msg.fromRole === 'patient')
                return (
                  <div
                    key={msg.id}
                    className={`${styles.bubble} ${isMe ? styles.bubbleMe : styles.bubbleThem}`}
                  >
                    <div className={`${styles.bubbleContent} ${isMe ? styles.bubbleContentMe : styles.bubbleContentThem}`}>
                      <p className={styles.bubbleText}>{msg.content}</p>
                      <span className={styles.bubbleTime}>
                        {new Date(msg.sentAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        {isMe && <span className={styles.readMark}>{msg.read ? ' ✓✓' : ' ✓'}</span>}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {sendError && <div role="alert" style={{ color: 'var(--cardio-red)', background: 'var(--bg-card)', fontSize: 13, padding: '8px 24px 0' }}>{sendError}</div>}
      <div className={styles.inputBar}>
        <textarea
          className={styles.textInput}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Escreva uma mensagem..."
          rows={1}
        />
        <button
          className={styles.sendBtn}
          onClick={handleSend}
          disabled={!input.trim() || sending}
          aria-label="Enviar mensagem"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
    </div>
  )
}

interface GroupedMessages {
  dateLabel: string
  msgs: ChatMessage[]
}

function groupMessagesByDate(messages: ChatMessage[]): GroupedMessages[] {
  const map = new Map<string, ChatMessage[]>()
  for (const msg of messages) {
    const date = new Date(msg.sentAt)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(today.getDate() - 1)

    let label: string
    if (isSameDay(date, today)) label = 'Hoje'
    else if (isSameDay(date, yesterday)) label = 'Ontem'
    else label = date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })

    if (!map.has(label)) map.set(label, [])
    map.get(label)!.push(msg)
  }
  return Array.from(map.entries()).map(([dateLabel, msgs]) => ({ dateLabel, msgs }))
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
}
