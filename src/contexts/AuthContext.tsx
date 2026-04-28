import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import type { Patient, UserRole } from '../models/types'
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

interface AuthContextType {
  isAuthenticated: boolean
  isLoading: boolean
  currentPatient: Patient | null
  errorMessage: string | null
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  selectPatient: (patient: Patient | null) => void
  restoreSelf: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
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
    setCurrentPatient(patient)
  }, [seedDemoPatients])

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

  const selectPatient = (patient: Patient | null) => {
    setCurrentPatient(patient)
  }

  const restoreSelf = async () => {
    const savedUserId = localStorage.getItem(AUTH_USER_KEY)
    if (!savedUserId) return
    const user = USERS.find((u) => u.userId === savedUserId)
    if (user) await setupPatient(user)
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
        restoreSelf,
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
