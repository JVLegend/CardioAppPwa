import { useState } from 'react'
import HomeView from './HomeView'
import HistoryView from './HistoryView'
import BluetoothView from './BluetoothView'
import MedicationsView from './MedicationsView'
import SettingsView from './SettingsView'
import styles from './MainTabView.module.css'

type Tab = 'home' | 'history' | 'bluetooth' | 'medications' | 'settings'

const tabs: { id: Tab; label: string; icon: string }[] = [
  { id: 'home', label: 'Inicio', icon: '🏠' },
  { id: 'history', label: 'Historico', icon: '📊' },
  { id: 'bluetooth', label: 'Aparelho', icon: '📱' },
  { id: 'medications', label: 'Remedios', icon: '💊' },
  { id: 'settings', label: 'Config', icon: '⚙️' },
]

export default function MainTabView() {
  const [activeTab, setActiveTab] = useState<Tab>('home')

  const renderTab = () => {
    switch (activeTab) {
      case 'home': return <HomeView />
      case 'history': return <HistoryView />
      case 'bluetooth': return <BluetoothView />
      case 'medications': return <MedicationsView />
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
            <span className={styles.tabIcon}>{tab.icon}</span>
            <span className={styles.tabLabel}>{tab.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
