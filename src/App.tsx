import { useState, useEffect } from 'react'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import LoginView from './views/LoginView'
import MainTabView from './views/MainTabView'
import PatientListView from './views/PatientListView'
import ControllerDashboardView from './views/ControllerDashboardView'
import DisclaimerView from './views/DisclaimerView'

const DISCLAIMER_KEY = 'cardioapp_disclaimer_accepted'

function AppContent() {
  const { isAuthenticated, isLoading, currentPatient } = useAuth()
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(
    () => localStorage.getItem(DISCLAIMER_KEY) === 'true'
  )

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === DISCLAIMER_KEY) {
        setDisclaimerAccepted(e.newValue === 'true')
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  if (isLoading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', flexDirection: 'column', gap: 12
      }}>
        <div style={{ fontSize: 48 }}>❤️</div>
        <div style={{ color: 'var(--text-secondary)' }}>Carregando...</div>
      </div>
    )
  }

  if (!disclaimerAccepted) {
    return (
      <DisclaimerView
        variant="onboarding"
        onAccept={() => {
          localStorage.setItem(DISCLAIMER_KEY, 'true')
          setDisclaimerAccepted(true)
        }}
      />
    )
  }

  if (!isAuthenticated) return <LoginView />

  if (currentPatient?.role === 'operator') return <PatientListView />
  if (currentPatient?.role === 'controller') return <ControllerDashboardView />

  return <MainTabView />
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}
