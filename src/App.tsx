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

  // Operadora de saúde (role=operator) → dashboard unificado: BI + gestão
  // de pacientes no mesmo painel.
  //
  // Controladora (role=controller) está desativada conforme decisão do cliente
  // — mas mantemos PatientListView no código pra reativar depois se for o
  // caso. O usuário controller acessa o mesmo painel da operadora.
  if (currentPatient?.role === 'operator' || currentPatient?.role === 'controller') {
    return <ControllerDashboardView />
  }

  return <MainTabView />
}

// PatientListView é referenciado aqui só para preservar a importação enquanto
// a view não está roteada (cliente pediu pra manter o arquivo no código).
void PatientListView

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}
