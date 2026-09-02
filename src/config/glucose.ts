import type { MealContext } from '../models/types'

export type GlucoseUnit = 'mg/dL' | 'mmol/L'

export const MIN_GLUCOSE_MG_DL = 10
export const MAX_GLUCOSE_MG_DL = 800
export const MMOL_TO_MG_DL = 18

export interface GlucoseClass {
  label: string
  color: string
}

export function classifyGlucose(value: number, context: MealContext): GlucoseClass {
  if (value < 70) return { label: 'Hipoglicemia', color: '#dc2626' }
  if (context === 'jejum' || context === 'pre_refeicao') {
    if (value <= 99) return { label: 'Normal', color: '#16a34a' }
    if (value <= 125) return { label: 'Glicemia alterada', color: '#A9822E' }
    if (value <= 180) return { label: 'Diabetes', color: '#C5A050' }
    return { label: 'Muito alta', color: '#dc2626' }
  }
  if (value <= 139) return { label: 'Normal', color: '#16a34a' }
  if (value <= 199) return { label: 'Tolerância alterada', color: '#A9822E' }
  if (value <= 250) return { label: 'Diabetes', color: '#C5A050' }
  return { label: 'Muito alta', color: '#dc2626' }
}

export function glucoseContextLabel(context: MealContext): string {
  switch (context) {
    case 'jejum': return 'Jejum'
    case 'pre_refeicao': return 'Pré-refeição'
    case 'pos_refeicao': return 'Pós-refeição'
    case 'aleatorio': return 'Aleatório'
  }
}
