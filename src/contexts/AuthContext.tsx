import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import type { Patient } from '../models/types'
import * as auth from '../services/authService'
import * as db from '../services/database'
import * as repo from '../services/supabaseRepository'
import { pullFromServer } from '../services/syncEngine'

interface AuthContextType {
  isAuthenticated: boolean
  isLoading: boolean
  currentPatient: Patient | null
  errorMessage: string | null
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  selectPatient: (patient: Patient) => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [currentPatient, setCurrentPatient] = useState<Patient | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const setupPatient = useCallback(async (userId: string) => {
    // Try local first
    let patient = await db.fetchPatientByUserId(userId)
    if (!patient) {
      // Try remote
      patient = (await repo.fetchPatientRemote(userId)) ?? undefined
      if (patient) {
        await db.savePatient(patient)
      } else {
        // Create new patient
        patient = {
          id: crypto.randomUUID(),
          operatorId: '',
          userId,
          name: 'Paciente',
          role: 'patient',
          createdAt: new Date().toISOString(),
        }
        await db.savePatient(patient)
        await repo.upsertPatientRemote(patient).catch(() => {})
      }
    }
    setCurrentPatient(patient!)
    pullFromServer(patient!.id).catch(() => {})
  }, [])

  useEffect(() => {
    auth.getSession().then((session) => {
      if (session?.user) {
        setIsAuthenticated(true)
        setupPatient(session.user.id)
      }
      setIsLoading(false)
    })
  }, [setupPatient])

  const login = async (email: string, password: string) => {
    setIsLoading(true)
    setErrorMessage(null)
    try {
      const session = await auth.signIn(email, password)
      setIsAuthenticated(true)
      await setupPatient(session!.user.id)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao fazer login'
      setErrorMessage(msg)
    } finally {
      setIsLoading(false)
    }
  }

  const logout = async () => {
    await auth.signOut().catch(() => {})
    setIsAuthenticated(false)
    setCurrentPatient(null)
  }

  const selectPatient = (patient: Patient) => {
    setCurrentPatient(patient)
    pullFromServer(patient.id).catch(() => {})
  }

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        currentPatient,
        errorMessage,
        login,
        logout,
        selectPatient,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
