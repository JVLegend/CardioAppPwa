export const colors = {
  cardioRed: '#C5A050',
  cardioBlue: '#001F3F',
  cardioGreen: '#16A34A',
  cardioWarm: '#E0B95C',
  cardioPurple: '#122036',
  cardioYellow: '#D4AF37',
  cardioTeal: '#D4AF37',
  cardioPink: '#E0B95C',

  bgPrimary: '#F7F9FC',
  bgSecondary: '#FFFFFF',
  bgCard: '#FFFFFF',
  bgCardHover: '#EEF2F6',

  textPrimary: '#0A1628',
  textSecondary: 'rgba(10,22,40,0.72)',
  textMuted: 'rgba(10,22,40,0.48)',

  border: 'rgba(10,22,40,0.10)',
  borderLight: 'rgba(10,22,40,0.16)',
}

export type BPClassification =
  | 'normal'
  | 'prehypertension'
  | 'stage1'
  | 'stage2'
  | 'crisis'

export const classificationConfig: Record<BPClassification, {
  label: string; color: string; icon: string; gradient: string; bg: string
}> = {
  normal: {
    label: 'Normal',
    color: '#16A34A',
    icon: '●',
    gradient: 'linear-gradient(135deg, #16A34A 0%, #22C55E 100%)',
    bg: '#F0FDF4',
  },
  prehypertension: {
    label: 'Pré-hipertensão',
    color: '#C5A050',
    icon: '●',
    gradient: 'linear-gradient(135deg, #D4AF37 0%, #C5A050 100%)',
    bg: '#FBF5E5',
  },
  stage1: {
    label: 'Hipertensão I',
    color: '#A9822E',
    icon: '●',
    gradient: 'linear-gradient(135deg, #C5A050 0%, #A9822E 100%)',
    bg: '#F7EFD8',
  },
  stage2: {
    label: 'Hipertensão II',
    color: '#001F3F',
    icon: '●',
    gradient: 'linear-gradient(135deg, #001F3F 0%, #0A1628 100%)',
    bg: '#E8EEF5',
  },
  crisis: {
    label: 'Pressão muito elevada',
    color: '#001F3F',
    icon: '●',
    gradient: 'linear-gradient(135deg, #001F3F 0%, #122036 100%)',
    bg: '#DCE3EB',
  },
}

export function classifyBP(systolic: number, diastolic: number): BPClassification {
  if (systolic >= 180 || diastolic >= 110) return 'crisis'
  if (systolic >= 160 || diastolic >= 100) return 'stage2'
  if (systolic >= 140 || diastolic >= 90) return 'stage1'
  if (systolic >= 120 || diastolic >= 80) return 'prehypertension'
  return 'normal'
}
