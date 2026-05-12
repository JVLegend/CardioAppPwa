// Lembretes diários de medição — pressão e glicose.
// Usa Notification API do navegador (PWA). Roda enquanto a aba está
// aberta — é o que dá pra fazer sem service worker dedicado.

export type ReminderKey = 'pressao' | 'glicose'

export interface ReminderConfig {
  enabled: boolean
  hour: number   // 0-23
  minute: number // 0-59
}

const DEFAULT: Record<ReminderKey, ReminderConfig> = {
  pressao: { enabled: false, hour: 8, minute: 0 },
  glicose: { enabled: false, hour: 8, minute: 0 },
}

const STORAGE_KEY = 'leve-control:reminders'
const EVENT = 'leve-control:reminders-change'

function load(): Record<ReminderKey, ReminderConfig> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT }
    const parsed = JSON.parse(raw)
    return {
      pressao: { ...DEFAULT.pressao, ...parsed.pressao },
      glicose: { ...DEFAULT.glicose, ...parsed.glicose },
    }
  } catch {
    return { ...DEFAULT }
  }
}

function persist(all: Record<ReminderKey, ReminderConfig>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
  window.dispatchEvent(new CustomEvent(EVENT, { detail: all }))
}

export function getReminders(): Record<ReminderKey, ReminderConfig> {
  return load()
}

export function getReminder(key: ReminderKey): ReminderConfig {
  return load()[key]
}

export function setReminder(key: ReminderKey, config: Partial<ReminderConfig>) {
  const all = load()
  all[key] = { ...all[key], ...config }
  persist(all)
}

export function onRemindersChange(cb: (all: Record<ReminderKey, ReminderConfig>) => void): () => void {
  const handler = (e: Event) => cb((e as CustomEvent).detail)
  window.addEventListener(EVENT, handler)
  return () => window.removeEventListener(EVENT, handler)
}

// ---------- Notificações ----------

const REMINDER_COPY: Record<ReminderKey, { title: string; body: string }> = {
  pressao: { title: 'Hora de medir a pressão', body: 'Toque para registrar sua medição.' },
  glicose: { title: 'Hora de medir a glicose', body: 'Toque para registrar sua medição.' },
}

function lastFiredKey(key: ReminderKey) {
  return `leve-control:reminders:last:${key}`
}

async function fire(key: ReminderKey) {
  const copy = REMINDER_COPY[key]
  try {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(copy.title, { body: copy.body, icon: '/pwa-192x192.png' })
    }
  } catch (e) {
    console.warn('[reminders] notification failed', e)
  }
}

function tick() {
  const all = load()
  const now = new Date()
  const today = now.toISOString().slice(0, 10) // YYYY-MM-DD
  for (const k of Object.keys(all) as ReminderKey[]) {
    const cfg = all[k]
    if (!cfg.enabled) continue
    if (now.getHours() !== cfg.hour) continue
    if (now.getMinutes() !== cfg.minute) continue
    const last = localStorage.getItem(lastFiredKey(k))
    if (last === today) continue
    localStorage.setItem(lastFiredKey(k), today)
    fire(k)
  }
}

let started = false
let intervalId: number | null = null

/** Inicia o loop de checagem (chamar 1× no boot do app). */
export function startReminders() {
  if (started) return
  started = true
  tick()
  intervalId = window.setInterval(tick, 60_000)
}

export function stopReminders() {
  started = false
  if (intervalId !== null) {
    window.clearInterval(intervalId)
    intervalId = null
  }
}

export async function ensureNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  const result = await Notification.requestPermission()
  return result === 'granted'
}
