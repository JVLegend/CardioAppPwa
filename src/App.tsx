import { AuthProvider, useAuth } from './contexts/AuthContext'
import LoginView from './views/LoginView'
import MainTabView from './views/MainTabView'
import PatientListView from './views/PatientListView'

function AppContent() {
  const { isAuthenticated, isLoading, currentPatient } = useAuth()

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

  if (!isAuthenticated) return <LoginView />

  if (currentPatient?.role === 'operator') return <PatientListView />

  return <MainTabView />
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}
