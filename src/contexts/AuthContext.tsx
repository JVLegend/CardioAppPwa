import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import type { Patient, PlanStatus, UserRole } from '../models/types'
import * as db from '../services/database'

interface HardcodedUser {
  email: string
  password: string
  userId: string
  name: string
  role: UserRole
  patientId: string
  operatorPatientId?: string
  phone?: string
  comorbidities?: string[]
  planStatus?: 'adimplente' | 'inadimplente' | 'pendente'
  inTreatmentPlan?: boolean
}

export interface CreatePatientProfileInput {
  name: string
  email: string
  password: string
  phone?: string
  birthDate?: string
  comorbidities?: string[]
  planStatus?: PlanStatus
  inTreatmentPlan?: boolean
}

// O acesso administrativo fica explícito e restrito ao e-mail da operadora.
// Se o responsável mudar, altere somente esta lista.
export const ADMIN_EMAILS = ['kneipapps@gmail.com'] as const

export function isAdminEmail(email: string | null | undefined) {
  return !!email && ADMIN_EMAILS.some((adminEmail) => adminEmail === email.trim().toLowerCase())
}

// Kneip é operadora; Toco e JV são pacientes vinculados à Kneip
const OPERATOR_KNEIP_ID = 'operator-kneipapps-001'

const USERS: HardcodedUser[] = [
  // Conta-demo apresentada à Apple App Review (espelha a do Swift app)
  {
    email: 'demo@cardioapp.app',
    password: 'Reviewer2026!',
    userId: 'fixed-user-demo',
    name: 'Reviewer Demo',
    role: 'patient',
    patientId: 'patient-demo-001',
    operatorPatientId: OPERATOR_KNEIP_ID,
    phone: '(11) 90000-0000',
    comorbidities: ['Hipertensão'],
    planStatus: 'adimplente',
    inTreatmentPlan: true,
  },
  {
    email: 'kneipapps@gmail.com',
    password: 'Phygital',
    userId: 'fixed-user-001',
    name: 'Dra. Kneip',
    role: 'operator',
    patientId: OPERATOR_KNEIP_ID,
  },
  {
    email: 'tocoapps@gmail.com',
    password: '123456',
    userId: 'fixed-user-002',
    name: 'Toco Silva',
    role: 'patient',
    patientId: 'patient-toco-001',
    operatorPatientId: OPERATOR_KNEIP_ID,
    phone: '(11) 98765-4321',
    comorbidities: ['Diabetes tipo 2', 'Dislipidemia'],
    planStatus: 'adimplente',
    inTreatmentPlan: true,
  },
  {
    email: 'jvapps@gmail.com',
    password: '123456',
    userId: 'fixed-user-003',
    name: 'JV Santos',
    role: 'patient',
    patientId: 'patient-jv-001',
    operatorPatientId: OPERATOR_KNEIP_ID,
    phone: '(11) 91234-5678',
    comorbidities: ['Obesidade'],
    planStatus: 'inadimplente',
    inTreatmentPlan: false,
  },
  {
    email: 'controlapps@gmail.com',
    password: '123456',
    userId: 'fixed-user-004',
    name: 'Ana Costa',
    role: 'controller',
    patientId: 'controller-control-001',
  },
]

const AUTH_KEY = 'cardioapp_auth'
const AUTH_USER_KEY = 'cardioapp_auth_user'
const DYNAMIC_USERS_KEY = 'cardioapp_dynamic_users'

function readDynamicUsers(): HardcodedUser[] {
  const raw = localStorage.getItem(DYNAMIC_USERS_KEY)
  if (!raw) return []

  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is HardcodedUser => {
      if (!item || typeof item !== 'object') return false
      const record = item as Record<string, unknown>
      return (
        typeof record.email === 'string' &&
        typeof record.password === 'string' &&
        typeof record.userId === 'string' &&
        typeof record.name === 'string' &&
        record.role === 'patient' &&
        typeof record.patientId === 'string'
      )
    })
  } catch {
    return []
  }
}

function allUsers() {
  return [...USERS, ...readDynamicUsers()]
}

interface AuthContextType {
  isAuthenticated: boolean
  isLoading: boolean
  currentUserEmail: string | null
  isAdmin: boolean
  currentPatient: Patient | null
  errorMessage: string | null
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  selectPatient: (patient: Patient | null) => void
  restoreSelf: () => Promise<void>
  createPatientProfile: (input: CreatePatientProfileInput) => Promise<Patient>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null)
  const [currentPatient, setCurrentPatient] = useState<Patient | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Garante que todos os pacientes demo existam no Dexie — médico (operator)
  // e operadora (controller) precisam enxergar a lista completa mesmo sem
  // que cada paciente individual tenha logado antes.
  const seedDemoPatients = useCallback(async () => {
    for (const u of USERS) {
      if (u.role !== 'patient') continue
      const existing = await db.fetchPatient(u.patientId)
      if (existing) continue
      await db.savePatient({
        id: u.patientId,
        operatorId: u.operatorPatientId ?? '',
        userId: u.userId,
        email: u.email,
        name: u.name,
        role: u.role,
        createdAt: new Date().toISOString(),
        phone: u.phone,
        comorbidities: u.comorbidities,
        planStatus: u.planStatus,
        inTreatmentPlan: u.inTreatmentPlan,
      })
    }
  }, [])

  const setupPatient = useCallback(async (user: HardcodedUser) => {
    // Controller/operator precisam da lista completa de demo patients para o painel
    if (user.role === 'controller' || user.role === 'operator') {
      await seedDemoPatients()
    }

    let patient = await db.fetchPatient(user.patientId)
    if (!patient) {
      patient = {
        id: user.patientId,
        operatorId: user.operatorPatientId ?? '',
        userId: user.userId,
        email: user.email,
        name: user.name,
        role: user.role,
        createdAt: new Date().toISOString(),
        phone: user.phone,
        comorbidities: user.comorbidities,
        planStatus: user.planStatus,
        inTreatmentPlan: user.inTreatmentPlan,
      }
      await db.savePatient(patient)
    } else {
      // Mantém sincronia de campos vindos do seed (útil para contas novas/atualizadas)
      const updated: Patient = {
        ...patient,
        email: patient.email ?? user.email,
        name: user.name,
        role: user.role,
        operatorId: user.operatorPatientId ?? patient.operatorId,
        phone: patient.phone ?? user.phone,
        comorbidities: patient.comorbidities ?? user.comorbidities,
        planStatus: patient.planStatus ?? user.planStatus,
        inTreatmentPlan: patient.inTreatmentPlan ?? user.inTreatmentPlan,
      }
      if (JSON.stringify(updated) !== JSON.stringify(patient)) {
        await db.savePatient(updated)
      }
      patient = updated
    }
    setCurrentUserEmail(user.email)
    setCurrentPatient(patient)
  }, [seedDemoPatients])

  useEffect(() => {
    const saved = localStorage.getItem(AUTH_KEY)
    const savedUserId = localStorage.getItem(AUTH_USER_KEY)
    if (saved === 'true' && savedUserId) {
      const user = allUsers().find((u) => u.userId === savedUserId)
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
    const user = allUsers().find(
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
    setCurrentUserEmail(null)
    setCurrentPatient(null)
  }

  const selectPatient = (patient: Patient | null) => {
    setCurrentPatient(patient)
  }

  const restoreSelf = async () => {
    const savedUserId = localStorage.getItem(AUTH_USER_KEY)
    if (!savedUserId) return
    const user = allUsers().find((u) => u.userId === savedUserId)
    if (user) await setupPatient(user)
  }

  const createPatientProfile = async (input: CreatePatientProfileInput): Promise<Patient> => {
    if (!isAdminEmail(currentUserEmail)) {
      throw new Error('Somente o administrador pode criar perfis.')
    }

    const name = input.name.trim()
    const email = input.email.trim().toLowerCase()
    const password = input.password
    if (!name || !email || !password) {
      throw new Error('Preencha nome, e-mail e senha inicial.')
    }
    if (password.length < 6) {
      throw new Error('A senha inicial precisa ter pelo menos 6 caracteres.')
    }
    if (allUsers().some((user) => user.email.toLowerCase() === email)) {
      throw new Error('Já existe um perfil com este e-mail.')
    }

    const userId = `profile-user-${crypto.randomUUID()}`
    const patientId = `patient-${crypto.randomUUID()}`
    const operatorId = currentPatient?.id ?? OPERATOR_KNEIP_ID
    const user: HardcodedUser = {
      email,
      password,
      userId,
      name,
      role: 'patient',
      patientId,
      operatorPatientId: operatorId,
      phone: input.phone?.trim() || undefined,
      comorbidities: input.comorbidities,
      planStatus: input.planStatus,
      inTreatmentPlan: input.inTreatmentPlan,
    }
    localStorage.setItem(DYNAMIC_USERS_KEY, JSON.stringify([...readDynamicUsers(), user]))

    const patient: Patient = {
      id: patientId,
      operatorId,
      userId,
      email,
      name,
      role: 'patient',
      birthDate: input.birthDate || undefined,
      phone: input.phone?.trim() || undefined,
      comorbidities: input.comorbidities,
      planStatus: input.planStatus,
      inTreatmentPlan: input.inTreatmentPlan,
      createdAt: new Date().toISOString(),
    }
    await db.savePatient(patient)
    return patient
  }

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        currentUserEmail,
        isAdmin: isAdminEmail(currentUserEmail),
        currentPatient,
        errorMessage,
        login,
        logout,
        selectPatient,
        restoreSelf,
        createPatientProfile,
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
