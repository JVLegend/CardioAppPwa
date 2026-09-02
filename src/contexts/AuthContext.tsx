import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Patient, PlanStatus, UserRole } from '../models/types'
import { changePassword, getAuthSession, signIn, signOut, type AuthSessionPayload } from '../services/authService'
import { clearClinicalCache, savePatient } from '../services/database'
import { createProfileRemote, resetProfilePassword as resetProfilePasswordRemote } from '../services/railwayRepository'
import { processPendingOperations, pullFromServer } from '../services/syncEngine'

export interface CreatePatientProfileInput {
  name: string
  email: string
  password: string
  role: UserRole
  phone?: string
  birthDate?: string
  state?: string
  comorbidities?: string[]
  planStatus?: PlanStatus
  inTreatmentPlan?: boolean
  operatorId?: string
}

interface AuthContextType {
  isAuthenticated: boolean
  isLoading: boolean
  mustChangePassword: boolean
  currentUserEmail: string | null
  isAdmin: boolean
  currentPatient: Patient | null
  errorMessage: string | null
  login: (email: string, password: string) => Promise<void>
  updatePassword: (password: string) => Promise<void>
  clearError: () => void
  logout: () => Promise<void>
  selectPatient: (patient: Patient | null) => void
  restoreSelf: () => Promise<void>
  createPatientProfile: (input: CreatePatientProfileInput) => Promise<Patient>
  resetProfilePassword: (profileId: string, password: string) => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)
const CACHE_OWNER_KEY = 'kardiaapp:cache-owner'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [mustChangePassword, setMustChangePassword] = useState(false)
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null)
  const [currentPatient, setCurrentPatient] = useState<Patient | null>(null)
  const [selfProfile, setSelfProfile] = useState<Patient | null>(null)
  const [pendingProfile, setPendingProfile] = useState<Patient | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const clearSessionState = useCallback(() => {
    setIsAuthenticated(false)
    setMustChangePassword(false)
    setSelfProfile(null)
    setPendingProfile(null)
    setCurrentPatient(null)
    setCurrentUserEmail(null)
  }, [])

  const finalizeProfile = useCallback(async (profile: Patient) => {
    const cacheOwner = localStorage.getItem(CACHE_OWNER_KEY)
    if (cacheOwner !== profile.id) await clearClinicalCache()
    localStorage.setItem(CACHE_OWNER_KEY, profile.id)
    await savePatient(profile)
    setSelfProfile(profile)
    setCurrentPatient(profile)
    setPendingProfile(null)
    setCurrentUserEmail(profile.email ?? null)
    setMustChangePassword(false)
    setIsAuthenticated(true)
    try {
      await processPendingOperations()
      await pullFromServer()
    } catch (error) {
      console.warn('[sync] sincronização inicial será repetida', error)
    }
    return profile
  }, [])

  const applySession = useCallback(async ({ profile, mustChangePassword: mustChange }: AuthSessionPayload) => {
    setCurrentUserEmail(profile.email ?? null)
    if (mustChange) {
      setPendingProfile(profile)
      setMustChangePassword(true)
      setIsAuthenticated(false)
      return profile
    }
    return finalizeProfile(profile)
  }, [finalizeProfile])

  useEffect(() => {
    let active = true
    getAuthSession()
      .then((session) => {
        if (active) return applySession(session)
        return undefined
      })
      .catch((error: unknown) => {
        if (!active) return
        const status = typeof error === 'object' && error && 'status' in error ? Number(error.status) : 0
        if (status !== 401) setErrorMessage(error instanceof Error ? error.message : 'Falha ao carregar a sessão')
      })
      .finally(() => { if (active) setIsLoading(false) })
    const expired = () => clearSessionState()
    window.addEventListener('kardia:session-expired', expired)
    return () => { active = false; window.removeEventListener('kardia:session-expired', expired) }
  }, [applySession, clearSessionState])

  useEffect(() => {
    if (!isAuthenticated) return
    const sync = () => { void processPendingOperations().then(() => pullFromServer()).catch(() => {}) }
    const interval = window.setInterval(sync, 60_000)
    window.addEventListener('focus', sync)
    return () => { window.clearInterval(interval); window.removeEventListener('focus', sync) }
  }, [isAuthenticated])

  const login = async (email: string, password: string) => {
    setIsLoading(true)
    setErrorMessage(null)
    try {
      await applySession(await signIn(email.trim(), password))
    } catch (error) {
      clearSessionState()
      setErrorMessage(error instanceof Error ? error.message : 'E-mail ou senha incorretos')
    } finally {
      setIsLoading(false)
    }
  }

  const updatePassword = async (password: string) => {
    setIsLoading(true)
    setErrorMessage(null)
    try {
      const session = await changePassword(password)
      await finalizeProfile(pendingProfile || session.profile)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Não foi possível atualizar a senha')
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  const logout = async () => {
    try { await signOut() } catch { /* o estado local deve ser encerrado mesmo sem rede */ }
    await clearClinicalCache()
    localStorage.removeItem(CACHE_OWNER_KEY)
    clearSessionState()
  }

  const selectPatient = (patient: Patient | null) => setCurrentPatient(patient ?? selfProfile)

  const restoreSelf = async () => {
    if (selfProfile) setCurrentPatient(selfProfile)
    else await applySession(await getAuthSession())
  }

  const createPatientProfile = async (input: CreatePatientProfileInput) => {
    const patient = await createProfileRemote(input)
    if (patient.role === 'patient') await savePatient(patient)
    await pullFromServer()
    return patient
  }

  const resetProfilePassword = async (profileId: string, password: string) => {
    await resetProfilePasswordRemote(profileId, password)
  }

  const isAdmin = selfProfile?.role === 'operator' || selfProfile?.role === 'controller'

  return (
    <AuthContext.Provider value={{
      isAuthenticated, isLoading, mustChangePassword, currentUserEmail, isAdmin,
      currentPatient, errorMessage, login, updatePassword,
      clearError: () => setErrorMessage(null), logout, selectPatient, restoreSelf,
      createPatientProfile, resetProfilePassword,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
