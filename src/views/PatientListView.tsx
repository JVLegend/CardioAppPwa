import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import type { Patient, Measurement } from '../models/types'
import * as db from '../services/database'
import { classifyBP, classificationConfig, type BPClassification } from '../config/theme'
import { sendBrowserNotification } from '../services/alertService'
import MainTabView from './MainTabView'
import styles from './PatientListView.module.css'

type DrillFilter =
  | 'all'
  | 'measuredToday'
  | 'notMeasuredToday'
  | 'inGoal'
  | 'outOfGoal'
  | 'critical'
  | 'adhering'
  | 'nonAdhering'
  | 'adimplente'
  | 'inadimplente'
  | 'inTreatment'
  | 'outOfTreatment'

interface PatientStats {
  patient: Patient
  latest: Measurement | undefined
  classification: BPClassification | null
  measuredToday: boolean
  measuredLast3Days: boolean
  activeMedications: number
  adhering: boolean // heurística: tem medicação ativa E mediu nos últimos 3 dias
  outOfGoalReason: string | null
}

function computeReason(c: BPClassification | null): string | null {
  if (!c) return null
  switch (c) {
    case 'crisis': return 'Crise hipertensiva — PA ≥ 180/110 mmHg'
    case 'stage2': return 'Hipertensão estágio II — PA 160-179/100-109 mmHg'
    case 'stage1': return 'Hipertensão estágio I — PA 140-159/90-99 mmHg'
    default: return null
  }
}

export default function PatientListView() {
  const { currentPatient, selectPatient, restoreSelf, logout } = useAuth()
  const [patients, setPatients] = useState<Patient[]>([])
  const [stats, setStats] = useState<PatientStats[]>([])
  const [loading, setLoading] = useState(true)
  const [drillFilter, setDrillFilter] = useState<DrillFilter>('all')
  const [search, setSearch] = useState('')
  const [detailPatient, setDetailPatient] = useState<PatientStats | null>(null)
  const [viewingPatient, setViewingPatient] = useState<Patient | null>(null)
  const [pushModal, setPushModal] = useState<Patient | null>(null)

  useEffect(() => {
    if (currentPatient?.role === 'operator') loadData()
  }, [currentPatient])

  async function loadData() {
    if (!currentPatient) return
    setLoading(true)
    const list = await db.fetchPatientsByOperator(currentPatient.id)
    setPatients(list)
    const ids = list.map((p) => p.id)
    const { latestMeasurements, measuredToday, activeMedicationCount, measuredLast3Days } =
      await db.fetchOperatorPatientStats(ids)

    const s: PatientStats[] = list.map((p) => {
      const latest = latestMeasurements.get(p.id)
      const c = latest ? classifyBP(latest.systolic, latest.diastolic) : null
      const activeMeds = activeMedicationCount.get(p.id) ?? 0
      const mt = measuredToday.has(p.id)
      const m3 = measuredLast3Days.has(p.id)
      const adhering = activeMeds > 0 ? m3 : mt // se toma remédio, precisa medir regularmente
      return {
        patient: p,
        latest,
        classification: c,
        measuredToday: mt,
        measuredLast3Days: m3,
        activeMedications: activeMeds,
        adhering,
        outOfGoalReason: computeReason(c),
      }
    })
    setStats(s)
    setLoading(false)
  }

  // Métricas
  const total = stats.length
  const mt = stats.filter((s) => s.measuredToday).length
  const nmt = total - mt
  const inGoal = stats.filter((s) => s.classification === 'normal' || s.classification === 'prehypertension').length
  const outOfGoal = stats.filter((s) => s.classification && ['stage1', 'stage2', 'crisis'].includes(s.classification)).length
  const critical = stats.filter((s) => s.classification === 'crisis' || s.classification === 'stage2').length
  const adhering = stats.filter((s) => s.adhering).length
  const nonAdhering = total - adhering
  const adimplente = stats.filter((s) => s.patient.planStatus === 'adimplente').length
  const inadimplente = stats.filter((s) => s.patient.planStatus === 'inadimplente').length
  const inTreatment = stats.filter((s) => s.patient.inTreatmentPlan).length
  const outOfTreatment = total - inTreatment

  function filteredStats(): PatientStats[] {
    let list = stats
    switch (drillFilter) {
      case 'measuredToday': list = list.filter((s) => s.measuredToday); break
      case 'notMeasuredToday': list = list.filter((s) => !s.measuredToday); break
      case 'inGoal': list = list.filter((s) => s.classification === 'normal' || s.classification === 'prehypertension'); break
      case 'outOfGoal': list = list.filter((s) => s.classification && ['stage1', 'stage2', 'crisis'].includes(s.classification)); break
      case 'critical': list = list.filter((s) => s.classification === 'crisis' || s.classification === 'stage2'); break
      case 'adhering': list = list.filter((s) => s.adhering); break
      case 'nonAdhering': list = list.filter((s) => !s.adhering); break
      case 'adimplente': list = list.filter((s) => s.patient.planStatus === 'adimplente'); break
      case 'inadimplente': list = list.filter((s) => s.patient.planStatus === 'inadimplente'); break
      case 'inTreatment': list = list.filter((s) => s.patient.inTreatmentPlan); break
      case 'outOfTreatment': list = list.filter((s) => !s.patient.inTreatmentPlan); break
    }
    if (search) list = list.filter((s) => s.patient.name.toLowerCase().includes(search.toLowerCase()))
    return list
  }

  async function handleBack() {
    setViewingPatient(null)
    await restoreSelf()
  }

  async function handleOpenFullProfile(patient: Patient) {
    selectPatient(patient)
    setViewingPatient(patient)
    setDetailPatient(null)
  }

  async function handleUpdatePatient(updated: Patient) {
    await db.savePatient(updated)
    await loadData()
    setDetailPatient((prev) => (prev ? { ...prev, patient: updated } : null))
  }

  if (viewingPatient) {
    return (
      <div className={styles.wrapper}>
        <div className={styles.patientBar}>
          <button className={styles.backBtn} onClick={handleBack}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--cardio-red)" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
            Dashboard
          </button>
          <span className={styles.patientBarName}>{viewingPatient.name}</span>
          <div style={{ width: 80 }} />
        </div>
        <MainTabView />
      </div>
    )
  }

  const filtered = filteredStats()

  const drillLabel: Record<DrillFilter, string> = {
    all: 'Todos os Pacientes',
    measuredToday: 'Mediram Hoje',
    notMeasuredToday: 'Não Mediram Hoje',
    inGoal: 'Dentro da Meta',
    outOfGoal: 'Fora da Meta',
    critical: 'Alertas Críticos',
    adhering: 'Aderentes à Medicação',
    nonAdhering: 'Não Aderentes',
    adimplente: 'Plano Adimplente',
    inadimplente: 'Plano Inadimplente',
    inTreatment: 'Em Plano de Tratamento',
    outOfTreatment: 'Sem Plano de Tratamento',
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
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
          Sair
        </button>
      </div>

      {/* Top banner */}
      <div className={styles.kpiSection}>
        <div className={styles.kpiCardTotal} onClick={() => setDrillFilter('all')}>
          <div>
            <span className={styles.kpiTotalValue}>{total}</span>
            <span className={styles.kpiTotalLabel}>Pacientes Conectados</span>
          </div>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.6"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></svg>
        </div>

        <div className={styles.metricGroup}>
          <h2 className={styles.sectionTitle}>Atividade de Hoje</h2>
          <div className={styles.kpiGrid}>
            <StatCard value={mt} label="Em dia" sub="Realizaram medição hoje" color="#16A34A" active={drillFilter === 'measuredToday'} onClick={() => setDrillFilter(drillFilter === 'measuredToday' ? 'all' : 'measuredToday')} />
            <StatCard value={nmt} label="Faltando" sub="Sem medição hoje" color="#D97706" active={drillFilter === 'notMeasuredToday'} onClick={() => setDrillFilter(drillFilter === 'notMeasuredToday' ? 'all' : 'notMeasuredToday')} />
          </div>
        </div>

        <div className={styles.metricGroup}>
          <h2 className={styles.sectionTitle}>Pressão Arterial</h2>
          <div className={styles.kpiGrid}>
            <StatCard value={inGoal} label="Dentro da Meta" sub="Normal ou pré-hipertensão" color="#16A34A" active={drillFilter === 'inGoal'} onClick={() => setDrillFilter(drillFilter === 'inGoal' ? 'all' : 'inGoal')} />
            <StatCard value={outOfGoal} label="Fora da Meta" sub="Hipertensão I, II ou crise" color="#C41230" active={drillFilter === 'outOfGoal'} onClick={() => setDrillFilter(drillFilter === 'outOfGoal' ? 'all' : 'outOfGoal')} />
          </div>
        </div>
        {critical > 0 && (
          <button
            className={`${styles.alertCard} ${drillFilter === 'critical' ? styles.alertCardActive : ''}`}
            onClick={() => setDrillFilter(drillFilter === 'critical' ? 'all' : 'critical')}
          >
            <div className={styles.alertIconWrap}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
            </div>
            <div className={styles.alertContent}>
              <div className={styles.alertTitle}>{critical} paciente{critical !== 1 ? 's' : ''} em estado crítico</div>
              <div className={styles.alertSub}>Toque para ver hipertensão II ou crise</div>
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--cardio-red)" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
          </button>
        )}

        <div className={styles.metricGroup}>
          <h2 className={styles.sectionTitle}>Aderência à Medicação</h2>
          <div className={styles.kpiGrid}>
            <StatCard value={adhering} label="Aderentes" sub="Tomando corretamente" color="#0891B2" active={drillFilter === 'adhering'} onClick={() => setDrillFilter(drillFilter === 'adhering' ? 'all' : 'adhering')} />
            <StatCard value={nonAdhering} label="Não Aderentes" sub="Precisam atenção" color="#D97706" active={drillFilter === 'nonAdhering'} onClick={() => setDrillFilter(drillFilter === 'nonAdhering' ? 'all' : 'nonAdhering')} />
          </div>
        </div>

        <div className={styles.metricGroup}>
          <h2 className={styles.sectionTitle}>
            Plano Financeiro <span className={styles.comingSoonTag}>API em breve</span>
          </h2>
          <div className={styles.kpiGrid}>
            <StatCard value={adimplente} label="Adimplentes" sub="Plano em dia" color="#16A34A" active={drillFilter === 'adimplente'} onClick={() => setDrillFilter(drillFilter === 'adimplente' ? 'all' : 'adimplente')} />
            <StatCard value={inadimplente} label="Inadimplentes" sub="Pendências financeiras" color="#C41230" active={drillFilter === 'inadimplente'} onClick={() => setDrillFilter(drillFilter === 'inadimplente' ? 'all' : 'inadimplente')} />
          </div>
        </div>

        <div className={`${styles.metricGroup} ${styles.metricGroupWide}`}>
          <h2 className={styles.sectionTitle}>Plano de Tratamento</h2>
          <div className={styles.kpiGrid}>
            <StatCard value={inTreatment} label="Em Tratamento" sub="Plano ativo na operadora" color="#1D4ED8" active={drillFilter === 'inTreatment'} onClick={() => setDrillFilter(drillFilter === 'inTreatment' ? 'all' : 'inTreatment')} />
            <StatCard value={outOfTreatment} label="Sem Plano" sub="Não estão em tratamento" color="#78716C" active={drillFilter === 'outOfTreatment'} onClick={() => setDrillFilter(drillFilter === 'outOfTreatment' ? 'all' : 'outOfTreatment')} />
          </div>
        </div>
      </div>

      {/* Patient List */}
      <div className={styles.listSection}>
        <div className={styles.listHeader}>
          <div>
            <h2 className={styles.sectionTitle}>{drillLabel[drillFilter]}</h2>
            <p className={styles.listCount}>{filtered.length} paciente{filtered.length !== 1 ? 's' : ''}</p>
          </div>
          {drillFilter !== 'all' && (
            <button className={styles.clearFilter} onClick={() => setDrillFilter('all')}>Limpar ×</button>
          )}
        </div>

        <div className={styles.searchRow}>
          <div className={styles.searchWrap}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
            <input className={styles.searchInput} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar paciente..." />
          </div>
        </div>

        {loading ? (
          <div className={styles.loadingRow}>{[1, 2, 3].map((i) => <div key={i} className={styles.skeleton} />)}</div>
        ) : filtered.length === 0 ? (
          <div className={styles.empty}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>
            <p className={styles.emptyText}>Nenhum paciente nesta categoria</p>
          </div>
        ) : (
          <div className={styles.list}>
            {filtered.map((s, i) => (
              <button
                key={s.patient.id}
                className={styles.patientItem}
                onClick={() => setDetailPatient(s)}
                style={{ animationDelay: `${i * 0.04}s` }}
              >
                <div className={styles.avatar}>{s.patient.name.charAt(0).toUpperCase()}</div>
                <div className={styles.patientInfo}>
                  <div className={styles.patientName}>{s.patient.name}</div>
                  <div className={styles.patientMeta}>
                    {s.latest ? (
                      <span className={`${styles.bpBadge} ${s.classification && ['stage1', 'stage2', 'crisis'].includes(s.classification) ? styles.bpBadgeRed : styles.bpBadgeGreen}`}>
                        {s.latest.systolic}/{s.latest.diastolic} mmHg
                      </span>
                    ) : (
                      <span className={styles.bpBadge}>Sem dados</span>
                    )}
                    <span className={`${styles.measureBadge} ${s.measuredToday ? styles.measureBadgeGreen : styles.measureBadgeOrange}`}>
                      {s.measuredToday ? 'Mediu hoje' : 'Sem medição'}
                    </span>
                    {!s.adhering && s.activeMedications > 0 && (
                      <span className={styles.measureBadge} style={{ background: '#FFFBEB', color: '#D97706' }}>
                        Não aderente
                      </span>
                    )}
                    {s.patient.planStatus === 'inadimplente' && (
                      <span className={styles.measureBadge} style={{ background: '#FFF1F2', color: '#C41230' }}>
                        Inadimplente
                      </span>
                    )}
                  </div>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Detail Drawer */}
      {detailPatient && (
        <PatientDetailDrawer
          stats={detailPatient}
          onClose={() => setDetailPatient(null)}
          onUpdate={handleUpdatePatient}
          onOpenFullProfile={() => handleOpenFullProfile(detailPatient.patient)}
          onSendPush={() => setPushModal(detailPatient.patient)}
        />
      )}

      {pushModal && (
        <PushNotificationModal
          patient={pushModal}
          onClose={() => setPushModal(null)}
        />
      )}
    </div>
  )
}

function StatCard({ value, label, sub, color, onClick, active }: {
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

function PatientDetailDrawer({ stats, onClose, onUpdate, onOpenFullProfile, onSendPush }: {
  stats: PatientStats
  onClose: () => void
  onUpdate: (p: Patient) => Promise<void>
  onOpenFullProfile: () => void
  onSendPush: () => void
}) {
  const { patient, latest, classification, outOfGoalReason, adhering, activeMedications } = stats
  const classConfig = classification ? classificationConfig[classification] : null
  const [editing, setEditing] = useState(false)
  const [comorbInput, setComorbInput] = useState((patient.comorbidities ?? []).join(', '))
  const [planStatus, setPlanStatus] = useState(patient.planStatus ?? 'pendente')
  const [inTreatmentPlan, setInTreatmentPlan] = useState(patient.inTreatmentPlan ?? false)
  const [phone, setPhone] = useState(patient.phone ?? '')

  async function handleSave() {
    const updated: Patient = {
      ...patient,
      comorbidities: comorbInput.split(',').map((s) => s.trim()).filter(Boolean),
      planStatus,
      inTreatmentPlan,
      phone: phone || undefined,
    }
    await onUpdate(updated)
    setEditing(false)
  }

  return (
    <div className={styles.drawerOverlay} onClick={onClose}>
      <div className={styles.drawer} onClick={(e) => e.stopPropagation()}>
        <div className={styles.drawerHandle} />

        <div className={styles.drawerHeader}>
          <div className={styles.drawerAvatar}>{patient.name.charAt(0).toUpperCase()}</div>
          <div style={{ flex: 1 }}>
            <div className={styles.drawerName}>{patient.name}</div>
            {patient.phone && <div className={styles.drawerPhone}>{patient.phone}</div>}
          </div>
          <button className={styles.closeBtn} onClick={onClose}>×</button>
        </div>

        {/* Última medição */}
        <div className={styles.drawerSection}>
          <h3 className={styles.drawerSectionTitle}>Última Medição</h3>
          {latest && classConfig ? (
            <div className={styles.drawerMeasureCard} style={{ borderLeftColor: classConfig.color }}>
              <div className={styles.drawerBP}>
                <span className={styles.drawerBPValue} style={{ color: classConfig.color }}>
                  {latest.systolic}/{latest.diastolic}
                </span>
                <span className={styles.drawerBPUnit}>mmHg</span>
              </div>
              <div className={styles.drawerBPClass} style={{ color: classConfig.color }}>{classConfig.label}</div>
              <div className={styles.drawerBPTime}>
                {new Date(latest.measuredAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
              </div>
              {outOfGoalReason && (
                <div className={styles.drawerReason}>
                  <strong>Motivo:</strong> {outOfGoalReason}
                </div>
              )}
            </div>
          ) : (
            <div className={styles.drawerEmpty}>Nenhuma medição registrada</div>
          )}
        </div>

        {/* Saúde */}
        <div className={styles.drawerSection}>
          <h3 className={styles.drawerSectionTitle}>Saúde e Plano</h3>
          <div className={styles.drawerInfoGrid}>
            <div className={styles.drawerInfoItem}>
              <span className={styles.drawerInfoLabel}>Medicações ativas</span>
              <span className={styles.drawerInfoValue}>{activeMedications}</span>
            </div>
            <div className={styles.drawerInfoItem}>
              <span className={styles.drawerInfoLabel}>Aderência</span>
              <span className={styles.drawerInfoValue} style={{ color: adhering ? '#16A34A' : '#D97706' }}>
                {adhering ? 'Em dia' : 'Precisa atenção'}
              </span>
            </div>
            <div className={styles.drawerInfoItem}>
              <span className={styles.drawerInfoLabel}>Plano financeiro</span>
              <span className={styles.drawerInfoValue} style={{
                color: patient.planStatus === 'adimplente' ? '#16A34A' : patient.planStatus === 'inadimplente' ? '#C41230' : 'var(--text-muted)',
              }}>
                {patient.planStatus === 'adimplente' ? 'Adimplente' : patient.planStatus === 'inadimplente' ? 'Inadimplente' : '—'}
              </span>
            </div>
            <div className={styles.drawerInfoItem}>
              <span className={styles.drawerInfoLabel}>Plano de tratamento</span>
              <span className={styles.drawerInfoValue} style={{ color: patient.inTreatmentPlan ? '#1D4ED8' : 'var(--text-muted)' }}>
                {patient.inTreatmentPlan ? 'Ativo' : 'Sem plano'}
              </span>
            </div>
          </div>

          {patient.comorbidities && patient.comorbidities.length > 0 && (
            <div className={styles.drawerComorb}>
              <span className={styles.drawerInfoLabel}>Comorbidades</span>
              <div className={styles.drawerChips}>
                {patient.comorbidities.map((c) => (
                  <span key={c} className={styles.chip}>{c}</span>
                ))}
              </div>
            </div>
          )}

          {editing ? (
            <div className={styles.editForm}>
              <div className={styles.editRow}>
                <label className={styles.editLabel}>Telefone</label>
                <input className={styles.editInput} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 99999-9999" />
              </div>
              <div className={styles.editRow}>
                <label className={styles.editLabel}>Comorbidades</label>
                <input className={styles.editInput} value={comorbInput} onChange={(e) => setComorbInput(e.target.value)} placeholder="Diabetes, Dislipidemia..." />
              </div>
              <div className={styles.editRow}>
                <label className={styles.editLabel}>Plano financeiro</label>
                <select className={styles.editInput} value={planStatus} onChange={(e) => setPlanStatus(e.target.value as any)}>
                  <option value="pendente">Pendente</option>
                  <option value="adimplente">Adimplente</option>
                  <option value="inadimplente">Inadimplente</option>
                </select>
              </div>
              <div className={styles.editRow}>
                <label className={styles.editLabel}>Em tratamento</label>
                <label className={styles.switch}>
                  <input type="checkbox" checked={inTreatmentPlan} onChange={(e) => setInTreatmentPlan(e.target.checked)} />
                  <span className={styles.slider} />
                </label>
              </div>
              <div className={styles.editActions}>
                <button className={styles.editCancel} onClick={() => setEditing(false)}>Cancelar</button>
                <button className={styles.editSave} onClick={handleSave}>Salvar</button>
              </div>
            </div>
          ) : (
            <button className={styles.editBtn} onClick={() => setEditing(true)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
              Editar informações
            </button>
          )}
        </div>

        {/* Comunicação */}
        <div className={styles.drawerSection}>
          <h3 className={styles.drawerSectionTitle}>Comunicação</h3>
          <div className={styles.commActions}>
            <button className={styles.pushBtn} onClick={onSendPush}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 01-3.46 0" /></svg>
              Enviar push no app
            </button>
            <button className={styles.whatsBtn} disabled>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" /></svg>
              WhatsApp
              <span className={styles.soonTag}>em breve</span>
            </button>
          </div>
        </div>

        <button className={styles.fullProfileBtn} onClick={onOpenFullProfile}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 3h7v7" /><line x1="10" y1="14" x2="21" y2="3" /><path d="M21 14v7h-7" /><line x1="14" y1="21" x2="3" y2="10" /></svg>
          Abrir perfil completo do paciente
        </button>
      </div>
    </div>
  )
}

function PushNotificationModal({ patient, onClose }: { patient: Patient; onClose: () => void }) {
  const [title, setTitle] = useState('Lembrete da Operadora')
  const [message, setMessage] = useState(`Olá ${patient.name.split(' ')[0]}, lembre-se de medir sua pressão hoje!`)
  const [sent, setSent] = useState(false)

  async function handleSend() {
    // Salva no chat para o paciente ver também
    const msg = {
      id: crypto.randomUUID(),
      operatorId: patient.operatorId,
      patientId: patient.id,
      fromRole: 'operator' as const,
      content: `${title}\n${message}`,
      sentAt: new Date().toISOString(),
      read: false,
    }
    await db.saveChatMessage(msg)
    // Dispara notificação browser (demo local)
    sendBrowserNotification(title, message)
    setSent(true)
    setTimeout(onClose, 1200)
  }

  return (
    <div className={styles.drawerOverlay} onClick={onClose}>
      <div className={styles.pushModal} onClick={(e) => e.stopPropagation()}>
        <h3 className={styles.pushTitle}>Enviar notificação push</h3>
        <p className={styles.pushSub}>Para {patient.name}</p>

        {sent ? (
          <div className={styles.sentState}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
            <p>Notificação enviada!</p>
          </div>
        ) : (
          <>
            <div className={styles.pushField}>
              <label className={styles.pushLabel}>Título</label>
              <input className={styles.pushInput} value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className={styles.pushField}>
              <label className={styles.pushLabel}>Mensagem</label>
              <textarea className={styles.pushTextarea} value={message} onChange={(e) => setMessage(e.target.value)} rows={3} />
            </div>
            <div className={styles.pushActions}>
              <button className={styles.editCancel} onClick={onClose}>Cancelar</button>
              <button className={styles.editSave} onClick={handleSend}>Enviar</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
