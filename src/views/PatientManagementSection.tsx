// Painel de gestão de pacientes para a operadora.
// Migrado do PatientListView original (controladora) e melhorado com:
//   • paleta LeveSaúde (sem #C41230 / #1D4ED8 hard-coded)
//   • KPI extra "Glicemia alterada" (>= 126 jejum / >= 200 aleatório)
//   • estatísticas de glicose carregadas em paralelo com BP
//   • compatível com modo embutido em outro dashboard
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import type { Patient, Measurement, GlucoseMeasurement } from '../models/types'
import * as db from '../services/database'
import { db as dexieDb } from '../services/database'
import { classifyBP, classificationConfig, type BPClassification } from '../config/theme'
import styles from './PatientManagementSection.module.css'

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
  | 'glucoseAltered'

interface PatientRow {
  patient: Patient
  latest: Measurement | undefined
  classification: BPClassification | null
  measuredToday: boolean
  activeMedications: number
  adhering: boolean
  outOfGoalReason: string | null
  latestGlucose: GlucoseMeasurement | undefined
  glucoseAltered: boolean
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

function isGlucoseAltered(g: GlucoseMeasurement | undefined): boolean {
  if (!g) return false
  if (g.context === 'jejum' || g.context === 'pre_refeicao') return g.value >= 126
  return g.value >= 200
}

export default function PatientManagementSection() {
  const { currentPatient } = useAuth()
  const [rows, setRows] = useState<PatientRow[]>([])
  const [loading, setLoading] = useState(true)
  const [drill, setDrill] = useState<DrillFilter>('all')
  const [search, setSearch] = useState('')
  const [drawer, setDrawer] = useState<PatientRow | null>(null)
  const [pushPatient, setPushPatient] = useState<Patient | null>(null)

  useEffect(() => {
    if (!currentPatient) return
    if (currentPatient.role !== 'operator' && currentPatient.role !== 'controller') return
    void loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPatient?.id])

  async function loadData() {
    if (!currentPatient) return
    setLoading(true)
    try {
      const list = currentPatient.role === 'controller'
        ? (await dexieDb.patients.toArray()).filter((p) => p.role === 'patient')
        : await db.fetchPatientsByOperator(currentPatient.id)
      const ids = list.map((p) => p.id)
      const [stats, allGlucose] = await Promise.all([
        db.fetchOperatorPatientStats(ids),
        dexieDb.glucoseMeasurements.toArray(),
      ])
      const latestGlucoseByPatient = new Map<string, GlucoseMeasurement>()
      for (const g of allGlucose) {
        const prev = latestGlucoseByPatient.get(g.patientId)
        if (!prev || new Date(g.measuredAt) > new Date(prev.measuredAt)) {
          latestGlucoseByPatient.set(g.patientId, g)
        }
      }
      const out: PatientRow[] = list.map((p) => {
        const latest = stats.latestMeasurements.get(p.id)
        const c = latest ? classifyBP(latest.systolic, latest.diastolic) : null
        const meds = stats.activeMedicationCount.get(p.id) ?? 0
        const mt = stats.measuredToday.has(p.id)
        const m3 = stats.measuredLast3Days.has(p.id)
        const latestGlucose = latestGlucoseByPatient.get(p.id)
        return {
          patient: p,
          latest,
          classification: c,
          measuredToday: mt,
          activeMedications: meds,
          adhering: meds > 0 ? m3 : mt,
          outOfGoalReason: computeReason(c),
          latestGlucose,
          glucoseAltered: isGlucoseAltered(latestGlucose),
        }
      })
      setRows(out)
    } catch (e) {
      console.error('[PatientManagementSection] loadData failed', e)
    } finally {
      setLoading(false)
    }
  }

  // Aggregates
  const m = useMemo(() => ({
    total: rows.length,
    measuredToday: rows.filter((r) => r.measuredToday).length,
    notMeasuredToday: rows.filter((r) => !r.measuredToday).length,
    inGoal: rows.filter((r) => r.classification === 'normal' || r.classification === 'prehypertension').length,
    outOfGoal: rows.filter((r) => r.classification && ['stage1', 'stage2', 'crisis'].includes(r.classification)).length,
    critical: rows.filter((r) => r.classification === 'crisis' || r.classification === 'stage2').length,
    adhering: rows.filter((r) => r.adhering).length,
    nonAdhering: rows.filter((r) => !r.adhering).length,
    adimplente: rows.filter((r) => r.patient.planStatus === 'adimplente').length,
    inadimplente: rows.filter((r) => r.patient.planStatus === 'inadimplente').length,
    inTreatment: rows.filter((r) => r.patient.inTreatmentPlan).length,
    outOfTreatment: rows.filter((r) => !r.patient.inTreatmentPlan).length,
    glucoseAltered: rows.filter((r) => r.glucoseAltered).length,
  }), [rows])

  const filtered = useMemo(() => {
    let list = rows
    switch (drill) {
      case 'measuredToday': list = list.filter((r) => r.measuredToday); break
      case 'notMeasuredToday': list = list.filter((r) => !r.measuredToday); break
      case 'inGoal': list = list.filter((r) => r.classification === 'normal' || r.classification === 'prehypertension'); break
      case 'outOfGoal': list = list.filter((r) => r.classification && ['stage1', 'stage2', 'crisis'].includes(r.classification)); break
      case 'critical': list = list.filter((r) => r.classification === 'crisis' || r.classification === 'stage2'); break
      case 'adhering': list = list.filter((r) => r.adhering); break
      case 'nonAdhering': list = list.filter((r) => !r.adhering); break
      case 'adimplente': list = list.filter((r) => r.patient.planStatus === 'adimplente'); break
      case 'inadimplente': list = list.filter((r) => r.patient.planStatus === 'inadimplente'); break
      case 'inTreatment': list = list.filter((r) => r.patient.inTreatmentPlan); break
      case 'outOfTreatment': list = list.filter((r) => !r.patient.inTreatmentPlan); break
      case 'glucoseAltered': list = list.filter((r) => r.glucoseAltered); break
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter((r) => r.patient.name.toLowerCase().includes(q))
    }
    return list
  }, [rows, drill, search])

  const DRILL_LABEL: Record<DrillFilter, string> = {
    all: 'Todos os pacientes',
    measuredToday: 'Mediram hoje',
    notMeasuredToday: 'Sem medição hoje',
    inGoal: 'Dentro da meta',
    outOfGoal: 'Fora da meta',
    critical: 'Estado crítico',
    adhering: 'Aderentes à medicação',
    nonAdhering: 'Não aderentes',
    adimplente: 'Plano adimplente',
    inadimplente: 'Plano inadimplente',
    inTreatment: 'Em plano de tratamento',
    outOfTreatment: 'Sem plano de tratamento',
    glucoseAltered: 'Glicemia alterada',
  }

  return (
    <section className={styles.wrapper}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Gestão de pacientes</h2>
        <p className={styles.sectionSubtitle}>
          Filtre por status clínico e abra cada paciente para detalhes.
        </p>
      </div>

      <div className={styles.kpiGrid}>
        <KpiPill label="Em dia · medição hoje" value={m.measuredToday} tone="green"
                 active={drill === 'measuredToday'} onClick={() => setDrill(drill === 'measuredToday' ? 'all' : 'measuredToday')} />
        <KpiPill label="Faltando hoje" value={m.notMeasuredToday} tone="amber"
                 active={drill === 'notMeasuredToday'} onClick={() => setDrill(drill === 'notMeasuredToday' ? 'all' : 'notMeasuredToday')} />
        <KpiPill label="Dentro da meta (PA)" value={m.inGoal} tone="green"
                 active={drill === 'inGoal'} onClick={() => setDrill(drill === 'inGoal' ? 'all' : 'inGoal')} />
        <KpiPill label="Fora da meta (PA)" value={m.outOfGoal} tone="coral"
                 active={drill === 'outOfGoal'} onClick={() => setDrill(drill === 'outOfGoal' ? 'all' : 'outOfGoal')} />
        <KpiPill label="Glicemia alterada" value={m.glucoseAltered} tone="coral"
                 active={drill === 'glucoseAltered'} onClick={() => setDrill(drill === 'glucoseAltered' ? 'all' : 'glucoseAltered')} />
        <KpiPill label="Não aderentes" value={m.nonAdhering} tone="amber"
                 active={drill === 'nonAdhering'} onClick={() => setDrill(drill === 'nonAdhering' ? 'all' : 'nonAdhering')} />
        <KpiPill label="Inadimplentes" value={m.inadimplente} tone="coral"
                 active={drill === 'inadimplente'} onClick={() => setDrill(drill === 'inadimplente' ? 'all' : 'inadimplente')} />
        <KpiPill label="Em tratamento" value={m.inTreatment} tone="plum"
                 active={drill === 'inTreatment'} onClick={() => setDrill(drill === 'inTreatment' ? 'all' : 'inTreatment')} />
      </div>

      {m.critical > 0 && (
        <button
          className={`${styles.alertCard} ${drill === 'critical' ? styles.alertActive : ''}`}
          onClick={() => setDrill(drill === 'critical' ? 'all' : 'critical')}
        >
          <span className={styles.alertIcon}>⚠</span>
          <div className={styles.alertText}>
            <strong>{m.critical} paciente{m.critical !== 1 ? 's' : ''}</strong> em estado crítico (hipertensão II ou crise)
          </div>
          <span className={styles.alertChevron}>›</span>
        </button>
      )}

      <div className={styles.listHeader}>
        <div>
          <h3 className={styles.listTitle}>{DRILL_LABEL[drill]}</h3>
          <p className={styles.listCount}>{filtered.length} paciente{filtered.length !== 1 ? 's' : ''}</p>
        </div>
        {drill !== 'all' && (
          <button className={styles.clearBtn} onClick={() => setDrill('all')}>Limpar filtro ×</button>
        )}
      </div>

      <div className={styles.searchRow}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="7" />
          <line x1="21" y1="21" x2="16.5" y2="16.5" />
        </svg>
        <input
          className={styles.searchInput}
          placeholder="Buscar paciente…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className={styles.loadingList}>
          {[1, 2, 3].map((i) => <div key={i} className={styles.skeleton} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className={styles.empty}>Nenhum paciente nesta categoria.</div>
      ) : (
        <div className={styles.list}>
          {filtered.map((r) => (
            <button key={r.patient.id} className={styles.row} onClick={() => setDrawer(r)}>
              <span className={styles.avatar}>{r.patient.name.charAt(0).toUpperCase()}</span>
              <div className={styles.rowMain}>
                <div className={styles.rowName}>{r.patient.name}</div>
                <div className={styles.rowMeta}>
                  {r.latest ? (
                    <span className={`${styles.tag} ${r.classification && ['stage1', 'stage2', 'crisis'].includes(r.classification) ? styles.tagCoral : styles.tagGreen}`}>
                      PA {r.latest.systolic}/{r.latest.diastolic}
                    </span>
                  ) : (
                    <span className={styles.tag}>Sem PA</span>
                  )}
                  {r.latestGlucose && (
                    <span className={`${styles.tag} ${r.glucoseAltered ? styles.tagCoral : styles.tagGreen}`}>
                      Gli {r.latestGlucose.value}
                    </span>
                  )}
                  <span className={`${styles.tag} ${r.measuredToday ? styles.tagGreen : styles.tagAmber}`}>
                    {r.measuredToday ? 'Mediu hoje' : 'Sem medição'}
                  </span>
                  {!r.adhering && r.activeMedications > 0 && (
                    <span className={`${styles.tag} ${styles.tagAmber}`}>Não aderente</span>
                  )}
                  {r.patient.planStatus === 'inadimplente' && (
                    <span className={`${styles.tag} ${styles.tagCoral}`}>Inadimplente</span>
                  )}
                </div>
              </div>
              <span className={styles.chevron}>›</span>
            </button>
          ))}
        </div>
      )}

      {drawer && (
        <DetailDrawer
          row={drawer}
          onClose={() => setDrawer(null)}
          onUpdate={async (updated) => {
            await db.savePatient(updated)
            await loadData()
            setDrawer((prev) => (prev ? { ...prev, patient: updated } : prev))
          }}
          onSendMessage={() => setPushPatient(drawer.patient)}
        />
      )}

      {pushPatient && (
        <PushModal patient={pushPatient} onClose={() => setPushPatient(null)} />
      )}
    </section>
  )
}

function KpiPill({
  label, value, tone, active, onClick,
}: { label: string; value: number; tone: 'coral' | 'plum' | 'green' | 'amber'; active: boolean; onClick: () => void }) {
  return (
    <button
      className={`${styles.kpi} ${styles[`tone_${tone}`]} ${active ? styles.kpiActive : ''}`}
      onClick={onClick}
    >
      <span className={styles.kpiValue}>{value}</span>
      <span className={styles.kpiLabel}>{label}</span>
    </button>
  )
}

function DetailDrawer({
  row, onClose, onUpdate, onSendMessage,
}: {
  row: PatientRow
  onClose: () => void
  onUpdate: (p: Patient) => Promise<void>
  onSendMessage: () => void
}) {
  const { patient, latest, classification, outOfGoalReason, latestGlucose, glucoseAltered, adhering, activeMedications } = row
  const classConfig = classification ? classificationConfig[classification] : null
  const [editing, setEditing] = useState(false)
  const [phone, setPhone] = useState(patient.phone ?? '')
  const [comorbInput, setComorbInput] = useState((patient.comorbidities ?? []).join(', '))
  const [planStatus, setPlanStatus] = useState(patient.planStatus ?? 'pendente')
  const [inTreatmentPlan, setInTreatmentPlan] = useState(patient.inTreatmentPlan ?? false)

  const save = async () => {
    await onUpdate({
      ...patient,
      phone: phone || undefined,
      comorbidities: comorbInput.split(',').map((s) => s.trim()).filter(Boolean),
      planStatus,
      inTreatmentPlan,
    })
    setEditing(false)
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <aside className={styles.drawer} onClick={(e) => e.stopPropagation()}>
        <button className={styles.drawerClose} onClick={onClose} aria-label="Fechar">×</button>

        <header className={styles.drawerHeader}>
          <span className={styles.drawerAvatar}>{patient.name.charAt(0).toUpperCase()}</span>
          <div>
            <h3 className={styles.drawerName}>{patient.name}</h3>
            {patient.phone && <p className={styles.drawerPhone}>{patient.phone}</p>}
          </div>
        </header>

        <section className={styles.drawerSection}>
          <h4 className={styles.drawerSectionTitle}>Última medição</h4>
          {latest && classConfig ? (
            <div className={styles.measureCard} style={{ borderLeftColor: classConfig.color }}>
              <div className={styles.measureBp} style={{ color: classConfig.color }}>
                {latest.systolic}/{latest.diastolic} <span className={styles.measureUnit}>mmHg</span>
              </div>
              <div className={styles.measureClass} style={{ color: classConfig.color }}>
                {classConfig.label}
              </div>
              <div className={styles.measureTime}>
                {new Date(latest.measuredAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
              </div>
              {outOfGoalReason && (
                <div className={styles.measureReason}>{outOfGoalReason}</div>
              )}
            </div>
          ) : (
            <div className={styles.drawerEmpty}>Sem medições registradas.</div>
          )}
        </section>

        <section className={styles.drawerSection}>
          <h4 className={styles.drawerSectionTitle}>Glicemia</h4>
          {latestGlucose ? (
            <div className={styles.measureCard} style={{ borderLeftColor: glucoseAltered ? 'var(--leve-coral)' : 'var(--cardio-green)' }}>
              <div className={styles.measureBp} style={{ color: glucoseAltered ? 'var(--leve-coral)' : 'var(--cardio-green)' }}>
                {latestGlucose.value} <span className={styles.measureUnit}>mg/dL</span>
              </div>
              <div className={styles.measureClass} style={{ color: glucoseAltered ? 'var(--leve-coral)' : 'var(--cardio-green)' }}>
                {glucoseAltered ? 'Alterada' : 'Em faixa'} · {ctxLabel(latestGlucose.context)}
              </div>
              <div className={styles.measureTime}>
                {new Date(latestGlucose.measuredAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
              </div>
            </div>
          ) : (
            <div className={styles.drawerEmpty}>Sem medições de glicemia.</div>
          )}
        </section>

        <section className={styles.drawerSection}>
          <h4 className={styles.drawerSectionTitle}>Saúde e plano</h4>
          <div className={styles.kvGrid}>
            <div className={styles.kv}>
              <span className={styles.kvLabel}>Medicações ativas</span>
              <span className={styles.kvValue}>{activeMedications}</span>
            </div>
            <div className={styles.kv}>
              <span className={styles.kvLabel}>Aderência</span>
              <span className={styles.kvValue} style={{ color: adhering ? 'var(--cardio-green)' : '#D97706' }}>
                {adhering ? 'Em dia' : 'Atenção'}
              </span>
            </div>
            <div className={styles.kv}>
              <span className={styles.kvLabel}>Plano financeiro</span>
              <span className={styles.kvValue} style={{
                color: patient.planStatus === 'adimplente' ? 'var(--cardio-green)' : patient.planStatus === 'inadimplente' ? 'var(--leve-coral)' : 'var(--text-muted)',
              }}>
                {patient.planStatus === 'adimplente' ? 'Adimplente' : patient.planStatus === 'inadimplente' ? 'Inadimplente' : '—'}
              </span>
            </div>
            <div className={styles.kv}>
              <span className={styles.kvLabel}>Tratamento</span>
              <span className={styles.kvValue} style={{ color: patient.inTreatmentPlan ? 'var(--leve-plum)' : 'var(--text-muted)' }}>
                {patient.inTreatmentPlan ? 'Ativo' : 'Sem plano'}
              </span>
            </div>
          </div>

          {patient.comorbidities && patient.comorbidities.length > 0 && (
            <div className={styles.chips}>
              {patient.comorbidities.map((c) => <span key={c} className={styles.chip}>{c}</span>)}
            </div>
          )}

          {editing ? (
            <div className={styles.editForm}>
              <label className={styles.editLabel}>Telefone
                <input className={styles.editInput} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 99999-9999" />
              </label>
              <label className={styles.editLabel}>Comorbidades (separadas por vírgula)
                <input className={styles.editInput} value={comorbInput} onChange={(e) => setComorbInput(e.target.value)} placeholder="Diabetes, Dislipidemia..." />
              </label>
              <label className={styles.editLabel}>Plano financeiro
                <select className={styles.editInput} value={planStatus} onChange={(e) => setPlanStatus(e.target.value as NonNullable<Patient['planStatus']>)}>
                  <option value="pendente">Pendente</option>
                  <option value="adimplente">Adimplente</option>
                  <option value="inadimplente">Inadimplente</option>
                </select>
              </label>
              <label className={styles.editCheckLabel}>
                <input type="checkbox" checked={inTreatmentPlan} onChange={(e) => setInTreatmentPlan(e.target.checked)} />
                Em plano de tratamento
              </label>
              <div className={styles.editActions}>
                <button className={styles.btnGhost} onClick={() => setEditing(false)}>Cancelar</button>
                <button className={styles.btnPrimary} onClick={save}>Salvar</button>
              </div>
            </div>
          ) : (
            <button className={styles.btnOutline} onClick={() => setEditing(true)}>Editar informações</button>
          )}
        </section>

        <section className={styles.drawerSection}>
          <h4 className={styles.drawerSectionTitle}>Comunicação</h4>
          <button className={styles.btnPrimary} onClick={onSendMessage}>Enviar mensagem no chat</button>
        </section>
      </aside>
    </div>
  )
}

function ctxLabel(ctx: GlucoseMeasurement['context']): string {
  switch (ctx) {
    case 'jejum': return 'Jejum'
    case 'pre_refeicao': return 'Pré-refeição'
    case 'pos_refeicao': return 'Pós-refeição'
    case 'aleatorio': return 'Aleatório'
  }
}

function PushModal({ patient, onClose }: { patient: Patient; onClose: () => void }) {
  const [message, setMessage] = useState(
    `Olá ${patient.name.split(' ')[0]}, lembre-se de medir sua pressão hoje!`
  )
  const [sent, setSent] = useState(false)

  const send = async () => {
    await db.saveChatMessage({
      id: crypto.randomUUID(),
      operatorId: patient.operatorId,
      patientId: patient.id,
      fromRole: 'operator',
      content: message,
      sentAt: new Date().toISOString(),
      read: false,
    })
    setSent(true)
    setTimeout(onClose, 1400)
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.pushModal} onClick={(e) => e.stopPropagation()}>
        <h3 className={styles.pushTitle}>Enviar mensagem</h3>
        <p className={styles.pushSub}>Para {patient.name} · cai direto no chat dele(a)</p>
        {sent ? (
          <div className={styles.pushSent}>✓ Mensagem enviada</div>
        ) : (
          <>
            <textarea
              className={styles.pushTextarea}
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              autoFocus
            />
            <div className={styles.editActions}>
              <button className={styles.btnGhost} onClick={onClose}>Cancelar</button>
              <button className={styles.btnPrimary} onClick={send} disabled={!message.trim()}>
                Enviar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
