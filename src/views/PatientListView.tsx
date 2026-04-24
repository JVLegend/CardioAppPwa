import { useState, useEffect, type FormEvent } from 'react'
import { useAuth } from '../contexts/AuthContext'
import type { Patient, Measurement } from '../models/types'
import * as db from '../services/database'
import { enqueue } from '../services/syncEngine'
import { classifyBP } from '../config/theme'
import MainTabView from './MainTabView'
import styles from './PatientListView.module.css'

type BPStatus = 'inGoal' | 'outOfGoal'
type DrillFilter = 'inGoal' | 'outOfGoal' | 'measuredToday' | 'notMeasuredToday' | null

interface PatientStats {
  patient: Patient
  latest: Measurement | undefined
  measuredToday: boolean
  bpStatus: BPStatus | null
}

function StatCard({
  value, label, sub, color, onClick, active,
}: {
  value: number; label: string; sub: string; color: string; onClick: () => void; active: boolean
}) {
  return (
    <button
      className={`${styles.statCard} ${active ? styles.statCardActive : ''}`}
      style={{ '--card-accent': color } as React.CSSProperties}
      onClick={onClick}
    >
      <span className={styles.statValue} style={{ color }}>{value}</span>
      <span className={styles.statLabel}>{label}</span>
      <span className={styles.statSub}>{sub}</span>
    </button>
  )
}

export default function PatientListView() {
  const { currentPatient, selectPatient, logout } = useAuth()
  const [patients, setPatients] = useState<Patient[]>([])
  const [patientStats, setPatientStats] = useState<PatientStats[]>([])
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [drillFilter, setDrillFilter] = useState<DrillFilter>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (currentPatient) {
      loadPatients()
    }
  }, [currentPatient])

  async function loadPatients() {
    if (!currentPatient) return
    setLoading(true)
    const list = await db.fetchPatientsByOperator(currentPatient.id)
    setPatients(list)
    const ids = list.map((p) => p.id)
    const { latestMeasurements, measuredToday } = await db.fetchOperatorPatientStats(ids)

    const stats: PatientStats[] = list.map((p) => {
      const latest = latestMeasurements.get(p.id)
      let bpStatus: BPStatus | null = null
      if (latest) {
        const cls = classifyBP(latest.systolic, latest.diastolic)
        bpStatus = cls === 'normal' || cls === 'prehypertension' ? 'inGoal' : 'outOfGoal'
      }
      return { patient: p, latest, measuredToday: measuredToday.has(p.id), bpStatus }
    })
    setPatientStats(stats)
    setLoading(false)
  }

  const total = patients.length
  const inGoal = patientStats.filter((s) => s.bpStatus === 'inGoal').length
  const outOfGoal = patientStats.filter((s) => s.bpStatus === 'outOfGoal').length
  const measuredToday = patientStats.filter((s) => s.measuredToday).length
  const notMeasuredToday = patientStats.filter((s) => !s.measuredToday).length

  function getFilteredStats(): PatientStats[] {
    let list = patientStats
    if (drillFilter === 'inGoal') list = list.filter((s) => s.bpStatus === 'inGoal')
    else if (drillFilter === 'outOfGoal') list = list.filter((s) => s.bpStatus === 'outOfGoal')
    else if (drillFilter === 'measuredToday') list = list.filter((s) => s.measuredToday)
    else if (drillFilter === 'notMeasuredToday') list = list.filter((s) => !s.measuredToday)
    if (search) list = list.filter((s) => s.patient.name.toLowerCase().includes(search.toLowerCase()))
    return list
  }

  const handleAddPatient = (e: FormEvent) => {
    e.preventDefault()
    if (!newName || !currentPatient) return
    const patient: Patient = {
      id: crypto.randomUUID(),
      operatorId: currentPatient.id,
      name: newName,
      phone: newPhone || undefined,
      role: 'patient',
      createdAt: new Date().toISOString(),
    }
    db.savePatient(patient)
    enqueue('patient', patient.id, 'create', patient)
    setNewName('')
    setNewPhone('')
    setShowAdd(false)
    loadPatients()
  }

  const handleSelectPatient = (patient: Patient) => {
    selectPatient(patient)
    setSelectedPatient(patient)
  }

  const handleToggleDrill = (filter: DrillFilter) => {
    setDrillFilter((prev) => (prev === filter ? null : filter))
  }

  if (selectedPatient) {
    return (
      <div className={styles.wrapper}>
        <div className={styles.patientBar}>
          <button className={styles.backBtn} onClick={() => { setSelectedPatient(null); selectPatient(null as any) }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--cardio-red)" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
            Pacientes
          </button>
          <span className={styles.patientBarName}>{selectedPatient.name}</span>
          <div style={{ width: 80 }} />
        </div>
        <MainTabView />
      </div>
    )
  }

  const displayedStats = getFilteredStats()

  const drillLabel: Record<NonNullable<DrillFilter>, string> = {
    inGoal: 'Dentro da Meta',
    outOfGoal: 'Fora da Meta',
    measuredToday: 'Mediram Hoje',
    notMeasuredToday: 'Não Mediram Hoje',
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <p className={styles.headerLabel}>Painel da Operadora</p>
          <h1 className={styles.headerTitle}>Olá, {currentPatient?.name?.split(' ')[0] ?? 'Operadora'}</h1>
          <p className={styles.headerDate}>
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <button className={styles.logoutBtn} onClick={logout}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
          Sair
        </button>
      </div>

      {/* KPI Cards */}
      <div className={styles.kpiSection}>
        <h2 className={styles.sectionTitle}>Visão Geral</h2>
        <div className={styles.kpiGrid}>
          <div className={styles.kpiCardTotal}>
            <span className={styles.kpiTotalValue}>{total}</span>
            <span className={styles.kpiTotalLabel}>Pacientes Monitorados</span>
          </div>
          <StatCard value={inGoal} label="Dentro da Meta" sub="PA normal ou pré-hipertensão" color="#16A34A" onClick={() => handleToggleDrill('inGoal')} active={drillFilter === 'inGoal'} />
          <StatCard value={outOfGoal} label="Fora da Meta" sub="Hipertensão I, II ou crise" color="#C41230" onClick={() => handleToggleDrill('outOfGoal')} active={drillFilter === 'outOfGoal'} />
          <StatCard value={measuredToday} label="Mediram Hoje" sub="Realizaram medição hoje" color="#1D4ED8" onClick={() => handleToggleDrill('measuredToday')} active={drillFilter === 'measuredToday'} />
          <StatCard value={notMeasuredToday} label="Não Mediram" sub="Sem medição hoje" color="#D97706" onClick={() => handleToggleDrill('notMeasuredToday')} active={drillFilter === 'notMeasuredToday'} />
        </div>
      </div>

      {/* Patient List */}
      <div className={styles.listSection}>
        <div className={styles.listHeader}>
          <div>
            <h2 className={styles.sectionTitle}>
              {drillFilter ? drillLabel[drillFilter] : 'Todos os Pacientes'}
            </h2>
            <p className={styles.listCount}>{displayedStats.length} paciente{displayedStats.length !== 1 ? 's' : ''}</p>
          </div>
          {drillFilter && (
            <button className={styles.clearFilter} onClick={() => setDrillFilter(null)}>
              Limpar filtro ×
            </button>
          )}
        </div>

        <div className={styles.searchRow}>
          <div className={styles.searchWrap}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
            <input
              className={styles.searchInput}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar paciente..."
            />
          </div>
          <button className={styles.addBtn} onClick={() => setShowAdd(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            Adicionar
          </button>
        </div>

        {showAdd && (
          <div className={styles.formCard}>
            <h3 className={styles.formTitle}>Novo Paciente</h3>
            <form onSubmit={handleAddPatient}>
              <div className={styles.inputGroup}>
                <div className={styles.inputRow}>
                  <label className={styles.inputLabel}>Nome</label>
                  <input className={styles.input} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nome completo" required />
                </div>
                <div className={styles.inputDivider} />
                <div className={styles.inputRow}>
                  <label className={styles.inputLabel}>Telefone</label>
                  <input className={styles.input} value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="(11) 99999-9999" />
                </div>
              </div>
              <div className={styles.formActions}>
                <button type="button" className={styles.cancelBtn} onClick={() => setShowAdd(false)}>Cancelar</button>
                <button type="submit" className={styles.saveBtn}>Salvar</button>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <div className={styles.loadingRow}>
            {[1, 2, 3].map((i) => <div key={i} className={styles.skeleton} />)}
          </div>
        ) : displayedStats.length === 0 ? (
          <div className={styles.empty}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></svg>
            <p className={styles.emptyText}>Nenhum paciente encontrado</p>
          </div>
        ) : (
          <div className={styles.list}>
            {displayedStats.map(({ patient, latest, measuredToday: mt, bpStatus }, i) => (
              <button
                key={patient.id}
                className={styles.patientItem}
                onClick={() => handleSelectPatient(patient)}
                style={{ animationDelay: `${i * 0.04}s` }}
              >
                <div className={styles.avatar}>
                  {patient.name.charAt(0).toUpperCase()}
                </div>
                <div className={styles.patientInfo}>
                  <div className={styles.patientName}>{patient.name}</div>
                  <div className={styles.patientMeta}>
                    {latest ? (
                      <span className={`${styles.bpBadge} ${bpStatus === 'outOfGoal' ? styles.bpBadgeRed : styles.bpBadgeGreen}`}>
                        {latest.systolic}/{latest.diastolic} mmHg
                      </span>
                    ) : (
                      <span className={styles.bpBadge}>Sem dados</span>
                    )}
                    <span className={`${styles.measureBadge} ${mt ? styles.measureBadgeGreen : styles.measureBadgeOrange}`}>
                      {mt ? 'Mediu hoje' : 'Sem medição hoje'}
                    </span>
                  </div>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
