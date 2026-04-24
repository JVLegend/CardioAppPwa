import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import type { Patient } from '../models/types'
import * as db from '../services/database'

interface HardcodedUser {
  email: string
  password: string
  userId: string
  name: string
}

const USERS: HardcodedUser[] = [
  { email: 'kneipapps@gmail.com', password: 'Phygital', userId: 'fixed-user-001', name: 'Kneip' },
  { email: 'tocoapps@gmail.com', password: '123456', userId: 'fixed-user-002', name: 'Toco' },
  { email: 'jvapps@gmail.com', password: '123456', userId: 'fixed-user-003', name: 'JV' },
]

const AUTH_KEY = 'cardioapp_auth'
const AUTH_USER_KEY = 'cardioapp_auth_user'

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

  const setupPatient = useCallback(async (user: HardcodedUser) => {
    let patient = await db.fetchPatientByUserId(user.userId)
    if (!patient) {
      patient = {
        id: crypto.randomUUID(),
        operatorId: '',
        userId: user.userId,
        name: user.name,
        role: 'patient',
        createdAt: new Date().toISOString(),
      }
      await db.savePatient(patient)
    }
    setCurrentPatient(patient)
  }, [])

  useEffect(() => {
    const saved = localStorage.getItem(AUTH_KEY)
    const savedUserId = localStorage.getItem(AUTH_USER_KEY)
    if (saved === 'true' && savedUserId) {
      const user = USERS.find((u) => u.userId === savedUserId)
      if (user) {
        setIsAuthenticated(true)
        setupPatient(user).finally(() => setIsLoading(false))
        return
      }
    }
    setIsLoading(false)
  }, [setupPatient])

  const login = async (email: string, password: string) => {
    setIsLoading(true)
    setErrorMessage(null)
    const user = USERS.find(
      (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password
    )
    if (user) {
      localStorage.setItem(AUTH_KEY, 'true')
      localStorage.setItem(AUTH_USER_KEY, user.userId)
      setIsAuthenticated(true)
      await setupPatient(user)
    } else {
      setErrorMessage('Email ou senha incorretos')
    }
    setIsLoading(false)
  }

  const logout = async () => {
    localStorage.removeItem(AUTH_KEY)
    localStorage.removeItem(AUTH_USER_KEY)
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
