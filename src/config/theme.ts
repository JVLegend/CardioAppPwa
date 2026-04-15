export const colors = {
  cardioRed: '#FF3B30',
  cardioBlue: '#007AFF',
  cardioGreen: '#34C759',
  cardioOrange: '#FF9500',
  cardioPurple: '#AF52DE',
  cardioYellow: '#FFCC00',
  cardioTeal: '#5AC8FA',
  cardioPink: '#FF2D55',

  bgPrimary: '#000000',
  bgSecondary: '#1C1C1E',
  bgCard: '#1C1C1E',
  bgCardHover: '#2C2C2E',

  textPrimary: '#FFFFFF',
  textSecondary: 'rgba(255,255,255,0.6)',
  textMuted: 'rgba(255,255,255,0.35)',

  border: 'rgba(255,255,255,0.08)',
  borderLight: 'rgba(255,255,255,0.12)',
}

export type BPClassification =
  | 'normal'
  | 'prehypertension'
  | 'stage1'
  | 'stage2'
  | 'crisis'

export const classificationConfig: Record<BPClassification, {
  label: string; color: string; icon: string; gradient: string
}> = {
  normal: {
    label: 'Normal',
    color: '#34C759',
    icon: '●',
    gradient: 'linear-gradient(135deg, #34C759 0%, #30D158 100%)',
  },
  prehypertension: {
    label: 'Pre-hipertensao',
    color: '#FFCC00',
    icon: '●',
    gradient: 'linear-gradient(135deg, #FFCC00 0%, #FFD60A 100%)',
  },
  stage1: {
    label: 'Hipertensao I',
    color: '#FF9500',
    icon: '●',
    gradient: 'linear-gradient(135deg, #FF9500 0%, #FF9F0A 100%)',
  },
  stage2: {
    label: 'Hipertensao II',
    color: '#FF3B30',
    icon: '●',
    gradient: 'linear-gradient(135deg, #FF3B30 0%, #FF453A 100%)',
  },
  crisis: {
    label: 'Crise Hipertensiva',
    color: '#AF52DE',
    icon: '●',
    gradient: 'linear-gradient(135deg, #AF52DE 0%, #BF5AF2 100%)',
  },
}

export function classifyBP(systolic: number, diastolic: number): BPClassification {
  if (systolic >= 180 || diastolic >= 110) return 'crisis'
  if (systolic >= 160 || diastolic >= 100) return 'stage2'
  if (systolic >= 140 || diastolic >= 90) return 'stage1'
  if (systolic >= 120 || diastolic >= 80) return 'prehypertension'
  return 'normal'
}
