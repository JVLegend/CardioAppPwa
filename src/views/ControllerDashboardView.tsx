import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import {
  db,
  fetchOperatorPatientStats,
  fetchActiveAlerts,
} from '../services/database'
import type { Patient, Measurement, BPAlert } from '../models/types'
import DashboardCharts from './DashboardCharts'
import styles from './ControllerDashboardView.module.css'

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

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <div className={styles.eyebrow}>Painel da Operadora</div>
          <h1 className={styles.title}>Olá, {currentPatient?.name ?? 'Doutor(a)'}</h1>
          <div className={styles.subtitle}>{today} · Visão diária dos seus pacientes</div>
        </div>
        <button className={styles.logoutBtn} onClick={logout}>
          Sair
        </button>
      </header>

      <DashboardCharts patients={allPatients} />

      <div className={styles.topGrid}>
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
              <p key={i} className={line.startsWith('•') ? styles.bullet : undefined}>
                {line}
              </p>
            ))
          )}
        </div>
      </section>

      <section className={styles.kpiGrid} data-role="kpi">
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Pacientes monitorados</div>
          <div className={styles.kpiValue}>{agg.totalPatients}</div>
          <div className={styles.kpiHint}>{agg.totalOperators} operadora(s)</div>
        </div>
        <div className={`${styles.kpiCard} ${styles.kpiGreen}`}>
          <div className={styles.kpiLabel}>Dentro da meta</div>
          <div className={styles.kpiValue}>{goalRate}%</div>
          <div className={styles.kpiHint}>{agg.inGoal} / {agg.totalPatients} pacientes</div>
        </div>
        <div className={`${styles.kpiCard} ${styles.kpiBlue}`}>
          <div className={styles.kpiLabel}>Medição hoje</div>
          <div className={styles.kpiValue}>{measurementRate}%</div>
          <div className={styles.kpiHint}>
            {agg.measuredToday} mediram · {agg.notMeasuredToday} pendente(s)
          </div>
        </div>
        <div className={`${styles.kpiCard} ${styles.kpiAmber}`}>
          <div className={styles.kpiLabel}>Aderência</div>
          <div className={styles.kpiValue}>{adherenceRate}%</div>
          <div className={styles.kpiHint}>{agg.nonAdhering} sem medição 3d</div>
        </div>
      </section>
      </div>

      <div className={styles.bottomGrid}>
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Ações prioritárias</h2>
        <div className={styles.actionsGrid}>

        {agg.critical > 0 && (
          <div className={`${styles.actionCard} ${styles.actionCrítical}`}>
            <div className={styles.actionHeader}>
              <span className={styles.actionBadge}>Urgente</span>
              <span className={styles.actionCount}>{agg.critical}</span>
            </div>
            <div className={styles.actionTitle}>Crise hipertensiva detectada</div>
            <div className={styles.actionBody}>
              Paciente(s) com PA ≥ 180/110 mmHg na última medição. Contato médico imediato recomendado.
            </div>
            <ul className={styles.patientList}>
              {agg.criticalPatients.slice(0, 5).map(({ patient, measurement }) => (
                <li key={patient.id}>
                  <strong>{patient.name}</strong>{' '}
                  <span className={styles.bp}>
                    {measurement.systolic}/{measurement.diastolic} mmHg
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {agg.nonAdhering > 0 && (
          <div className={`${styles.actionCard} ${styles.actionWarn}`}>
            <div className={styles.actionHeader}>
              <span className={`${styles.actionBadge} ${styles.badgeWarn}`}>Atenção</span>
              <span className={styles.actionCount}>{agg.nonAdhering}</span>
            </div>
            <div className={styles.actionTitle}>Baixa aderência à medicação</div>
            <div className={styles.actionBody}>
              Pacientes com medicação ativa sem medição nos últimos 3 dias. Acionar operadora para reforço.
            </div>
          </div>
        )}

        {agg.inadimplentes > 0 && (
          <div className={`${styles.actionCard} ${styles.actionInfo}`}>
            <div className={styles.actionHeader}>
              <span className={`${styles.actionBadge} ${styles.badgeInfo}`}>Financeiro</span>
              <span className={styles.actionCount}>{agg.inadimplentes}</span>
            </div>
            <div className={styles.actionTitle}>Inadimplência no plano</div>
            <div className={styles.actionBody}>
              Pacientes com pendência financeira. Integração com API financeira em breve.
            </div>
          </div>
        )}

        {agg.critical === 0 && agg.nonAdhering === 0 && agg.inadimplentes === 0 && (
          <div className={styles.emptyState}>
            ✓ Nenhuma ação crítica no momento. Operação estável.
          </div>
        )}
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Distribuição clínica</h2>
        <div className={styles.distGrid}>
          <div className={styles.distRow}>
            <div className={styles.distLabel}>Dentro da meta</div>
            <div className={styles.distBar}>
              <div
                className={styles.distFillGreen}
                style={{ width: `${goalRate}%` }}
              />
            </div>
            <div className={styles.distValue}>{agg.inGoal}</div>
          </div>
          <div className={styles.distRow}>
            <div className={styles.distLabel}>Fora da meta</div>
            <div className={styles.distBar}>
              <div
                className={styles.distFillRed}
                style={{
                  width: `${
                    agg.totalPatients > 0
                      ? (agg.outOfGoal / agg.totalPatients) * 100
                      : 0
                  }%`,
                }}
              />
            </div>
            <div className={styles.distValue}>{agg.outOfGoal}</div>
          </div>
          <div className={styles.distRow}>
            <div className={styles.distLabel}>Em tratamento</div>
            <div className={styles.distBar}>
              <div
                className={styles.distFillBlue}
                style={{
                  width: `${
                    agg.totalPatients > 0
                      ? (agg.inTreatment / agg.totalPatients) * 100
                      : 0
                  }%`,
                }}
              />
            </div>
            <div className={styles.distValue}>{agg.inTreatment}</div>
          </div>
        </div>
      </section>
      </div>

      <footer className={styles.footer}>
        CardioApp · Painel da Operadora · Protótipo
      </footer>
    </div>
  )
}
