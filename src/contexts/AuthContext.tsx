import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import type { Patient } from '../models/types'
import * as db from '../services/database'

const FIXED_EMAIL = 'kneipapps@gmail.com'
const FIXED_PASSWORD = 'Phygital'
const FIXED_USER_ID = 'fixed-user-001'
const AUTH_KEY = 'cardioapp_auth'

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

  const setupPatient = useCallback(async () => {
    let patient = await db.fetchPatientByUserId(FIXED_USER_ID)
    if (!patient) {
      patient = {
        id: crypto.randomUUID(),
        operatorId: '',
        userId: FIXED_USER_ID,
        name: 'Paciente',
        role: 'patient',
        createdAt: new Date().toISOString(),
      }
      await db.savePatient(patient)
    }
    setCurrentPatient(patient)
  }, [])

  useEffect(() => {
    const saved = localStorage.getItem(AUTH_KEY)
    if (saved === 'true') {
      setIsAuthenticated(true)
      setupPatient().finally(() => setIsLoading(false))
    } else {
      setIsLoading(false)
    }
  }, [setupPatient])

  const login = async (email: string, password: string) => {
    setIsLoading(true)
    setErrorMessage(null)
    if (email === FIXED_EMAIL && password === FIXED_PASSWORD) {
      localStorage.setItem(AUTH_KEY, 'true')
      setIsAuthenticated(true)
      await setupPatient()
    } else {
      setErrorMessage('Email ou senha incorretos')
    }
    setIsLoading(false)
  }

  const logout = async () => {
    localStorage.removeItem(AUTH_KEY)
    setIsAuthenticated(false)
    setCurrentPatient(null)
  }

  const selectPatient = (patient: Patient) => {
    setCurrentPatient(patient)
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
