export const colors = {
  cardioRed: '#C41230',
  cardioBlue: '#1D4ED8',
  cardioGreen: '#16A34A',
  cardioWarm: '#C33C55',
  cardioPurple: '#7C2D4A',
  cardioYellow: '#B4233C',
  cardioTeal: '#0891B2',
  cardioPink: '#DB2777',

  bgPrimary: '#FFF7F8',
  bgSecondary: '#FFFFFF',
  bgCard: '#FFFFFF',
  bgCardHover: '#FDECEF',

  textPrimary: '#32151C',
  textSecondary: 'rgba(50,21,28,0.58)',
  textMuted: 'rgba(50,21,28,0.35)',

  border: 'rgba(50,21,28,0.08)',
  borderLight: 'rgba(50,21,28,0.12)',
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
    color: '#B4233C',
    icon: '●',
    gradient: 'linear-gradient(135deg, #B4233C 0%, #D94F65 100%)',
    bg: '#FFF0F2',
  },
  stage1: {
    label: 'Hipertensão I',
    color: '#C6284A',
    icon: '●',
    gradient: 'linear-gradient(135deg, #C6284A 0%, #E05A70 100%)',
    bg: '#FDE8EC',
  },
  stage2: {
    label: 'Hipertensão II',
    color: '#9B1C31',
    icon: '●',
    gradient: 'linear-gradient(135deg, #9B1C31 0%, #C6284A 100%)',
    bg: '#FCE4E7',
  },
  crisis: {
    label: 'Crise Hipertensiva',
    color: '#7C2D4A',
    icon: '●',
    gradient: 'linear-gradient(135deg, #7C2D4A 0%, #B4233C 100%)',
    bg: '#F8E7EB',
  },
}

export function classifyBP(systolic: number, diastolic: number): BPClassification {
  if (systolic >= 180 || diastolic >= 110) return 'crisis'
  if (systolic >= 160 || diastolic >= 100) return 'stage2'
  if (systolic >= 140 || diastolic >= 90) return 'stage1'
  if (systolic >= 120 || diastolic >= 80) return 'prehypertension'
  return 'normal'
}
