import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import type { ChatMessage } from '../models/types'
import * as db from '../services/database'
import styles from './ChatView.module.css'

export default function ChatView() {
  const { currentPatient } = useAuth()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const operatorId = currentPatient?.operatorId ?? currentPatient?.id ?? ''
  const patientId = currentPatient?.id ?? ''
  const isOperator = currentPatient?.role === 'operator'

  useEffect(() => {
    if (!operatorId || !patientId) return
    loadMessages()
    const interval = setInterval(loadMessages, 5000)
    return () => clearInterval(interval)
  }, [operatorId, patientId])

  async function loadMessages() {
    const msgs = await db.fetchChatMessages(operatorId, patientId)
    setMessages(msgs)
    await db.markMessagesRead(operatorId, patientId, isOperator ? 'operator' : 'patient')
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }

  const handleSend = async () => {
    if (!input.trim() || sending) return
    setSending(true)
    const msg: ChatMessage = {
      id: crypto.randomUUID(),
      operatorId,
      patientId,
      fromRole: isOperator ? 'operator' : 'patient',
      content: input.trim(),
      sentAt: new Date().toISOString(),
      read: false,
    }
    setMessages((prev) => [...prev, msg])
    setInput('')
    await db.saveChatMessage(msg)
    setSending(false)
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
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
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerAvatar}>
          {isOperator ? 'P' : 'M'}
        </div>
        <div className={styles.headerInfo}>
          <p className={styles.headerName}>
            {isOperator ? 'Paciente' : 'Minha Equipe'}
          </p>
          <p className={styles.headerStatus}>Online</p>
        </div>
      </div>

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
