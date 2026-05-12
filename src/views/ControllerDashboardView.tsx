import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import {
  db,
  fetchOperatorPatientStats,
  fetchActiveAlerts,
} from '../services/database'
import type { Patient, Measurement, BPAlert } from '../models/types'
import { BRAZIL_STATES } from '../data/brazilStates'
import DashboardCharts from './DashboardCharts'
import BrazilMap from './BrazilMap'
import LeveSaudeLogo from './LeveSaudeLogo'
import PatientManagementSection from './PatientManagementSection'
import styles from './ControllerDashboardView.module.css'

const STATE_SIGLAS = BRAZIL_STATES.map((s) => s.sigla)
function stateFor(patientId: string): string {
  let h = 0
  for (let i = 0; i < patientId.length; i++) h = (h * 31 + patientId.charCodeAt(i)) >>> 0
  return STATE_SIGLAS[h % STATE_SIGLAS.length]
}
function stateName(s: string) {
  return BRAZIL_STATES.find((x) => x.sigla === s)?.name ?? s
}

type BPClass = 'normal' | 'prehypertension' | 'stage1' | 'stage2' | 'crisis'

function classifyBP(systolic: number, diastolic: number): BPClass {
  if (systolic >= 180 || diastolic >= 110) return 'crisis'
  if (systolic >= 140 || diastolic >= 90) return 'stage2'
  if (systolic >= 130 || diastolic >= 80) return 'stage1'
  if (systolic >= 120) return 'prehypertension'
  return 'normal'
}

interface Aggregates {
  totalPatients: number
  totalOperators: number
  measuredToday: number
  notMeasuredToday: number
  inGoal: number
  outOfGoal: number
  critical: number
  nonAdhering: number
  inadimplentes: number
  inTreatment: number
  criticalPatients: { patient: Patient; measurement: Measurement }[]
  alerts: BPAlert[]
}

const GEMINI_KEY = (import.meta as any).env?.VITE_GEMINI_API_KEY as string | undefined

async function generateInsight(agg: Aggregates): Promise<string> {
  if (!GEMINI_KEY) {
    return fallbackInsight(agg)
  }
  try {
    const prompt = `Você é uma IA assistente de um controlador de plano de saúde.
Analise os dados abaixo e produza um INSIGHT DIÁRIO em português (máx. 180 palavras), no tom executivo, com:
1) Resumo da operação (1 frase);
2) Principais riscos clínicos do dia;
3) 3 ações recomendadas priorizadas (use bullets com "•").

Dados agregados:
- Pacientes totais: ${agg.totalPatients}
- Operadores: ${agg.totalOperators}
- Medição hoje: ${agg.measuredToday} / sem medição: ${agg.notMeasuredToday}
- Dentro da meta: ${agg.inGoal} / fora da meta: ${agg.outOfGoal}
- Em crise hipertensiva: ${agg.critical}
- Baixa aderência à medicação: ${agg.nonAdhering}
- Inadimplentes: ${agg.inadimplentes}
- Em plano de tratamento ativo: ${agg.inTreatment}
- Alertas pendentes: ${agg.alerts.length}`
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    )
    const data = await resp.json()
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
    if (typeof text === 'string' && text.trim().length > 0) return text.trim()
    return fallbackInsight(agg)
  } catch {
    return fallbackInsight(agg)
  }
}

function fallbackInsight(agg: Aggregates): string {
  const parts: string[] = []
  parts.push(
    `Hoje ${agg.measuredToday} de ${agg.totalPatients} pacientes realizaram medição. ${agg.outOfGoal} estão fora da meta pressórica e ${agg.critical} em crise hipertensiva.`
  )
  parts.push('')
  parts.push('Ações recomendadas:')
  if (agg.critical > 0)
    parts.push(`• Priorizar contato imediato com ${agg.critical} paciente(s) em crise hipertensiva.`)
  if (agg.nonAdhering > 0)
    parts.push(`• Reforçar aderência com ${agg.nonAdhering} paciente(s) sem medição recente.`)
  if (agg.inadimplentes > 0)
    parts.push(`• Alinhar com financeiro para regularizar ${agg.inadimplentes} inadimplente(s).`)
  if (parts.length === 3) parts.push('• Operação estável — manter monitoramento de rotina.')
  return parts.join('\n')
}

export default function ControllerDashboardView() {
  const { logout, currentPatient } = useAuth()
  const [agg, setAgg] = useState<Aggregates | null>(null)
  const [allPatients, setAllPatients] = useState<Patient[]>([])
  const [insight, setInsight] = useState<string>('')
  const [loadingInsight, setLoadingInsight] = useState(false)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [stateFilter, setStateFilter] = useState<string>('all')

  async function loadAll() {
    setLoading(true)
    const dbPatients = await db.patients.toArray()
    const patients = dbPatients.filter((p) => p.role === 'patient')
    setAllPatients(patients)
    const operatorIds = new Set(patients.map((p) => p.operatorId).filter(Boolean))
    const patientIds = patients.map((p) => p.id)

    const stats = await fetchOperatorPatientStats(patientIds)

    let inGoal = 0
    let outOfGoal = 0
    let critical = 0
    const criticalPatients: { patient: Patient; measurement: Measurement }[] = []

    for (const p of patients) {
      const m = stats.latestMeasurements.get(p.id)
      if (!m) continue
      const cls = classifyBP(m.systolic, m.diastolic)
      if (cls === 'normal' || cls === 'prehypertension') inGoal++
      else outOfGoal++
      if (cls === 'crisis') {
        critical++
        criticalPatients.push({ patient: p, measurement: m })
      }
    }

    let nonAdhering = 0
    for (const p of patients) {
      const activeMeds = stats.activeMedicationCount.get(p.id) ?? 0
      if (activeMeds > 0 && !stats.measuredLast3Days.has(p.id)) nonAdhering++
    }

    const inadimplentes = patients.filter((p) => p.planStatus === 'inadimplente').length
    const inTreatment = patients.filter((p) => p.inTreatmentPlan).length

    const alertLists = await Promise.all(patients.map((p) => fetchActiveAlerts(p.id)))
    const alerts = alertLists.flat()

    const aggregates: Aggregates = {
      totalPatients: patients.length,
      totalOperators: operatorIds.size,
      measuredToday: stats.measuredToday.size,
      notMeasuredToday: patients.length - stats.measuredToday.size,
      inGoal,
      outOfGoal,
      critical,
      nonAdhering,
      inadimplentes,
      inTreatment,
      criticalPatients,
      alerts,
    }
    setAgg(aggregates)
    setLoading(false)

    setLoadingInsight(true)
    const text = await generateInsight(aggregates)
    setInsight(text)
    setLoadingInsight(false)
  }

  useEffect(() => {
    loadAll()
  }, [])

  const today = useMemo(
    () =>
      new Date().toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
      }),
    []
  )

  if (loading || !agg) {
    return (
      <div className={styles.loading}>
        <div className={styles.loadingHeart}>❤️</div>
        <div>Carregando painel de controle…</div>
      </div>
    )
  }

  const adherenceRate =
    agg.totalPatients > 0
      ? Math.round(((agg.totalPatients - agg.nonAdhering) / agg.totalPatients) * 100)
      : 0
  const goalRate =
    agg.totalPatients > 0 ? Math.round((agg.inGoal / agg.totalPatients) * 100) : 0
  const measurementRate =
    agg.totalPatients > 0 ? Math.round((agg.measuredToday / agg.totalPatients) * 100) : 0

  // Patient filtering for the BI charts (state + search) — separa da gestão
  // de pacientes lá embaixo (que tem o próprio search).
  const stateCounts: Record<string, number> = {}
  for (const p of allPatients) {
    const s = stateFor(p.id)
    stateCounts[s] = (stateCounts[s] ?? 0) + 1
  }
  const sortedStates = Object.entries(stateCounts).sort((a, b) => b[1] - a[1])
  const q = search.trim().toLowerCase()
  const filteredPatients = allPatients.filter((p) => {
    if (stateFilter !== 'all' && stateFor(p.id) !== stateFilter) return false
    if (!q) return true
    return (
      p.name.toLowerCase().includes(q) ||
      (p.phone || '').toLowerCase().includes(q) ||
      (p.comorbidities || []).some((c) => c.toLowerCase().includes(q))
    )
  })

  return (
    <div className={styles.container}>
      {/* HEADER — compacto, logo à esquerda */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <LeveSaudeLogo size={40} />
          <div>
            <div className={styles.eyebrow}>Painel da Operadora</div>
            <h1 className={styles.title}>Olá, {currentPatient?.name ?? 'Doutor(a)'}</h1>
            <div className={styles.subtitle}>{today}</div>
          </div>
        </div>
        <button className={styles.logoutBtn} onClick={logout}>Sair</button>
      </header>

      {/* FILTRO GLOBAL — search + estado */}
      <div className={styles.toolbar}>
        <div className={styles.searchWrap}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.5" y2="16.5" />
          </svg>
          <input
            className={styles.searchInput}
            placeholder="Buscar paciente, telefone ou comorbidade…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className={styles.stateSelect} value={stateFilter} onChange={(e) => setStateFilter(e.target.value)}>
          <option value="all">Todos os estados ({allPatients.length})</option>
          {sortedStates.map(([sigla, n]) => (
            <option key={sigla} value={sigla}>{stateName(sigla)} — {sigla} ({n})</option>
          ))}
        </select>
        <span className={styles.matchHint}>{filteredPatients.length} paciente(s)</span>
      </div>

      {/* KPI STRIP — 5 métricas resumidas */}
      <div className={styles.kpiStrip}>
        <KpiTile label="Pacientes" value={agg.totalPatients} hint={`${agg.totalOperators} operadora(s)`} accent="plum" />
        <KpiTile label="Mediram hoje" value={`${measurementRate}%`} hint={`${agg.measuredToday}/${agg.totalPatients}`} accent="green" />
        <KpiTile label="Dentro da meta" value={`${goalRate}%`} hint={`${agg.inGoal} pacientes`} accent="green" />
        <KpiTile label="Aderência" value={`${adherenceRate}%`} hint={`${agg.nonAdhering} sem medição 3d`} accent="amber" />
        <KpiTile label="Em crise / críticos" value={agg.critical} hint="PA ≥ 180/110 mmHg" accent={agg.critical > 0 ? 'coral' : 'plum'} />
      </div>

      {/* HERO — Insight (esquerda) + Mapa do Brasil (direita) */}
      <div className={styles.heroGrid}>
        <section className={styles.insightCard}>
          <div className={styles.insightHeader}>
            <span className={styles.insightBadge}>IA · Insight diário</span>
            <button
              className={styles.refreshBtn}
              onClick={async () => {
                setLoadingInsight(true)
                const text = await generateInsight(agg)
                setInsight(text)
                setLoadingInsight(false)
              }}
              disabled={loadingInsight}
            >
              {loadingInsight ? 'Gerando…' : '↻ Atualizar'}
            </button>
          </div>
          <div className={styles.insightBody}>
            {loadingInsight && !insight ? (
              <div className={styles.shimmerBlock} />
            ) : (
              insight.split('\n').map((line, i) => (
                <p key={i} className={line.startsWith('•') ? styles.bullet : undefined}>{line}</p>
              ))
            )}
          </div>
        </section>

        <section className={styles.mapCard}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Distribuição geográfica</h2>
            <span className={styles.cardHint}>{filteredPatients.length} paciente(s) selecionado(s)</span>
          </div>
          <BrazilMap
            counts={stateCounts}
            selected={stateFilter === 'all' ? null : stateFilter}
            onSelect={(s) => setStateFilter(s || 'all')}
          />
        </section>
      </div>

      {/* CHARTS — 3 colunas */}
      <section className={styles.chartsSection}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>Indicadores de saúde · últimos 7 dias</h2>
          <span className={styles.cardHint}>{filteredPatients.length} paciente(s)</span>
        </div>
        <DashboardCharts patients={filteredPatients} />
      </section>

      {/* AÇÕES PRIORITÁRIAS — horizontais */}
      <section className={styles.actionsSection}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>Ações prioritárias</h2>
        </div>
        <div className={styles.actionsRow}>
          {agg.critical > 0 && (
            <div className={`${styles.actionCard} ${styles.actionCritical}`}>
              <div className={styles.actionHead}>
                <span className={styles.actionBadge}>Urgente</span>
                <span className={styles.actionCount}>{agg.critical}</span>
              </div>
              <div className={styles.actionTitle}>Crise hipertensiva</div>
              <p className={styles.actionBody}>
                PA ≥ 180/110 mmHg na última medição. Contato médico imediato.
              </p>
              {agg.criticalPatients.length > 0 && (
                <ul className={styles.patientList}>
                  {agg.criticalPatients.slice(0, 3).map(({ patient, measurement }) => (
                    <li key={patient.id}>
                      <span>{patient.name}</span>
                      <span className={styles.bp}>{measurement.systolic}/{measurement.diastolic}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {agg.nonAdhering > 0 && (
            <div className={`${styles.actionCard} ${styles.actionWarn}`}>
              <div className={styles.actionHead}>
                <span className={`${styles.actionBadge} ${styles.badgeWarn}`}>Atenção</span>
                <span className={styles.actionCount}>{agg.nonAdhering}</span>
              </div>
              <div className={styles.actionTitle}>Baixa aderência</div>
              <p className={styles.actionBody}>
                Medicação ativa, sem medição nos últimos 3 dias. Acionar reforço.
              </p>
            </div>
          )}
          {agg.inadimplentes > 0 && (
            <div className={`${styles.actionCard} ${styles.actionInfo}`}>
              <div className={styles.actionHead}>
                <span className={`${styles.actionBadge} ${styles.badgeInfo}`}>Financeiro</span>
                <span className={styles.actionCount}>{agg.inadimplentes}</span>
              </div>
              <div className={styles.actionTitle}>Inadimplência</div>
              <p className={styles.actionBody}>
                Pendência financeira no plano. Integração com API financeira em breve.
              </p>
            </div>
          )}
          {agg.critical === 0 && agg.nonAdhering === 0 && agg.inadimplentes === 0 && (
            <div className={styles.emptyState}>✓ Nenhuma ação crítica. Operação estável.</div>
          )}
        </div>
      </section>

      {/* GESTÃO DE PACIENTES — filtros + lista + drawer */}
      <PatientManagementSection />

      <footer className={styles.footer}>
        Leve Control · Painel da Operadora · Protótipo
      </footer>
    </div>
  )
}

function KpiTile({
  label, value, hint, accent,
}: { label: string; value: number | string; hint: string; accent: 'plum' | 'coral' | 'green' | 'amber' }) {
  return (
    <div className={`${styles.kpiTile} ${styles[`accent_${accent}`]}`}>
      <div className={styles.kpiTileLabel}>{label}</div>
      <div className={styles.kpiTileValue}>{value}</div>
      <div className={styles.kpiTileHint}>{hint}</div>
    </div>
  )
}
