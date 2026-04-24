export const colors = {
  cardioRed: '#C41230',
  cardioBlue: '#1D4ED8',
  cardioGreen: '#16A34A',
  cardioOrange: '#D97706',
  cardioPurple: '#7C3AED',
  cardioYellow: '#CA8A04',
  cardioTeal: '#0891B2',
  cardioPink: '#DB2777',

  bgPrimary: '#F7F4EF',
  bgSecondary: '#FFFFFF',
  bgCard: '#FFFFFF',
  bgCardHover: '#F5F1EB',

  textPrimary: '#1C1917',
  textSecondary: 'rgba(28,25,23,0.58)',
  textMuted: 'rgba(28,25,23,0.35)',

  border: 'rgba(28,25,23,0.08)',
  borderLight: 'rgba(28,25,23,0.12)',
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
    color: '#CA8A04',
    icon: '●',
    gradient: 'linear-gradient(135deg, #CA8A04 0%, #EAB308 100%)',
    bg: '#FEFCE8',
  },
  stage1: {
    label: 'Hipertensão I',
    color: '#D97706',
    icon: '●',
    gradient: 'linear-gradient(135deg, #D97706 0%, #F59E0B 100%)',
    bg: '#FFFBEB',
  },
  stage2: {
    label: 'Hipertensão II',
    color: '#C41230',
    icon: '●',
    gradient: 'linear-gradient(135deg, #C41230 0%, #DC2626 100%)',
    bg: '#FFF1F2',
  },
  crisis: {
    label: 'Crise Hipertensiva',
    color: '#7C3AED',
    icon: '●',
    gradient: 'linear-gradient(135deg, #7C3AED 0%, #8B5CF6 100%)',
    bg: '#F5F3FF',
  },
}

export function classifyBP(systolic: number, diastolic: number): BPClassification {
  if (systolic >= 180 || diastolic >= 110) return 'crisis'
  if (systolic >= 160 || diastolic >= 100) return 'stage2'
  if (systolic >= 140 || diastolic >= 90) return 'stage1'
  if (systolic >= 120 || diastolic >= 80) return 'prehypertension'
  return 'normal'
}
