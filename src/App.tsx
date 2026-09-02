import { lazy, Suspense, useState, useEffect } from 'react'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import LoginView from './views/LoginView'
import DisclaimerView from './views/DisclaimerView'
import PwaUpdatePrompt from './views/PwaUpdatePrompt'

const MainTabView = lazy(() => import('./views/MainTabView'))
const PatientListView = lazy(() => import('./views/PatientListView'))
const ControllerDashboardView = lazy(() => import('./views/ControllerDashboardView'))

const DISCLAIMER_KEY = 'kpscardio_disclaimer_accepted'

function hasAcceptedDisclaimer() {
  return localStorage.getItem(DISCLAIMER_KEY) === 'true'
}

function LoadingScreen() {
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

function AppContent() {
  const { isAuthenticated, isLoading, mustChangePassword, currentUserRole } = useAuth()
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(
    hasAcceptedDisclaimer
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

  if (isLoading) return <LoadingScreen />

  if (mustChangePassword) return <LoginView />

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

  // A função do usuário autenticado define o painel. currentPatient pode mudar
  // temporariamente quando o médico abre o prontuário de um paciente.
  if (currentUserRole === 'operator') {
    return <Suspense fallback={<LoadingScreen />}><PatientListView /></Suspense>
  }

  if (currentUserRole === 'controller') {
    return <Suspense fallback={<LoadingScreen />}><ControllerDashboardView /></Suspense>
  }

  return <Suspense fallback={<LoadingScreen />}><MainTabView /></Suspense>
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
      <PwaUpdatePrompt />
    </AuthProvider>
  )
}
