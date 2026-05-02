import { useState } from 'react'
import HomeView from './HomeView'
import HistoryView from './HistoryView'
import BluetoothView from './BluetoothView'
import GlucoseView from './GlucoseView'
import MedicationsView from './MedicationsView'
import SettingsView from './SettingsView'
import ChatView from './ChatView'
import styles from './MainTabView.module.css'

type Tab = 'home' | 'history' | 'bluetooth' | 'glucose' | 'medications' | 'chat' | 'settings'

const tabs: { id: Tab; label: string }[] = [
  { id: 'bluetooth', label: 'Pressão' },
  { id: 'glucose', label: 'Glicose' },
  { id: 'home', label: 'Início' },
  { id: 'history', label: 'Histórico' },
  { id: 'medications', label: 'Remédios' },
  { id: 'chat', label: 'Chat' },
  { id: 'settings', label: 'Ajustes' },
]

const ACTIVE = 'var(--cardio-red)'
const INACTIVE = 'rgba(28,25,23,0.3)'

const tabIcons: Record<Tab, (active: boolean) => JSX.Element> = {
  home: (a) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={a ? ACTIVE : INACTIVE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
    </svg>
  ),
  history: (a) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={a ? ACTIVE : INACTIVE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  ),
  bluetooth: (a) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={a ? ACTIVE : INACTIVE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6.5 6.5 17.5 17.5 12 23 12 1 17.5 6.5 6.5 17.5" />
    </svg>
  ),
  glucose: (a) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={a ? ACTIVE : INACTIVE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2.5s-6 7-6 12a6 6 0 0012 0c0-5-6-12-6-12z" />
    </svg>
  ),
  medications: (a) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={a ? ACTIVE : INACTIVE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.5 1.5H8C4.7 1.5 2 4.2 2 7.5v0c0 3.3 2.7 6 6 6h2.5" />
      <path d="M13.5 22.5H16c3.3 0 6-2.7 6-6v0c0-3.3-2.7-6-6-6h-2.5" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  ),
  chat: (a) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={a ? ACTIVE : INACTIVE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  ),
  settings: (a) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={a ? ACTIVE : INACTIVE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  ),
}

export default function MainTabView() {
  const [activeTab, setActiveTab] = useState<Tab>('bluetooth')

  const renderTab = () => {
    switch (activeTab) {
      case 'home': return <HomeView />
      case 'history': return <HistoryView />
      case 'bluetooth': return <BluetoothView />
      case 'glucose': return <GlucoseView />
      case 'medications': return <MedicationsView />
      case 'chat': return <ChatView />
      case 'settings': return <SettingsView />
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.content}>{renderTab()}</div>
      <nav className={styles.tabBar}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`${styles.tab} ${activeTab === tab.id ? styles.active : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className={styles.tabIcon}>
              {tabIcons[tab.id](activeTab === tab.id)}
            </span>
            <span className={styles.tabLabel}>{tab.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
