export const colors = {
  cardioRed: '#D42E2E',
  cardioBlue: '#2E5AA5',
  cardioGreen: '#2E8C56',
  cardioOrange: '#E67D0E',
  cardioPurple: '#8F1F8F',
  cardioYellow: '#E6C60E',

  bgPrimary: '#0F0F1A',
  bgSecondary: '#1A1A2E',
  bgCard: '#1E1E32',
  bgCardHover: '#252540',

  textPrimary: '#FFFFFF',
  textSecondary: '#A0A0B8',
  textMuted: '#6B6B80',

  border: '#2A2A40',
  borderLight: '#3A3A55',
}

export type BPClassification =
  | 'normal'
  | 'prehypertension'
  | 'stage1'
  | 'stage2'
  | 'crisis'

export const classificationConfig: Record<BPClassification, {
  label: string; color: string; emoji: string
}> = {
  normal: { label: 'Normal', color: colors.cardioGreen, emoji: '💚' },
  prehypertension: { label: 'Pré-hipertensão', color: colors.cardioYellow, emoji: '💛' },
  stage1: { label: 'Hipertensão Estágio 1', color: colors.cardioOrange, emoji: '🧡' },
  stage2: { label: 'Hipertensão Estágio 2', color: colors.cardioRed, emoji: '❤️' },
  crisis: { label: 'Crise Hipertensiva', color: colors.cardioPurple, emoji: '💜' },
}

export function classifyBP(systolic: number, diastolic: number): BPClassification {
  if (systolic >= 180 || diastolic >= 110) return 'crisis'
  if (systolic >= 160 || diastolic >= 100) return 'stage2'
  if (systolic >= 140 || diastolic >= 90) return 'stage1'
  if (systolic >= 120 || diastolic >= 80) return 'prehypertension'
  return 'normal'
}
