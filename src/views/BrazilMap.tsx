import { useMemo } from 'react'
import { BRAZIL_STATES, BRAZIL_VIEWBOX, type BrazilState } from '../data/brazilStates'
import styles from './BrazilMap.module.css'

interface Props {
  /** sigla → contagem de pacientes */
  counts: Record<string, number>
  /** sigla atualmente selecionada (filtro) — opcional */
  selected?: string | null
  onSelect?: (sigla: string | null) => void
}

const BASE = '232, 78, 27' // coral LeveSaúde como rgba

export default function BrazilMap({ counts, selected, onSelect }: Props) {
  const max = useMemo(
    () => Math.max(1, ...Object.values(counts)),
    [counts]
  )

  const handleClick = (s: BrazilState) => {
    if (!onSelect) return
    onSelect(selected === s.sigla ? null : s.sigla)
  }

  return (
    <div className={styles.wrapper}>
      <svg
        viewBox={BRAZIL_VIEWBOX}
        className={styles.svg}
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Mapa do Brasil com a distribuição de pacientes por estado"
      >
        {BRAZIL_STATES.map((s) => {
          const n = counts[s.sigla] ?? 0
          const intensity = n === 0 ? 0 : Math.max(0.15, n / max)
          const fill = n === 0 ? 'rgba(74,19,64,0.05)' : `rgba(${BASE}, ${intensity.toFixed(2)})`
          const isSelected = selected === s.sigla
          return (
            <path
              key={s.sigla}
              d={s.d}
              fill={fill}
              stroke={isSelected ? 'var(--leve-plum)' : '#fff'}
              strokeWidth={isSelected ? 2.5 : 0.8}
              className={styles.state}
              onClick={() => handleClick(s)}
              aria-label={`${s.name}: ${n} paciente(s)`}
            >
              <title>{`${s.name} — ${n} paciente(s)`}</title>
            </path>
          )
        })}
        {/* Labels: sigla + count em estados com pacientes */}
        {BRAZIL_STATES.map((s) => {
          const n = counts[s.sigla] ?? 0
          if (n === 0) return null
          return (
            <g key={`label-${s.sigla}`} className={styles.labelGroup}>
              <text
                x={s.cx}
                y={s.cy - 4}
                textAnchor="middle"
                className={styles.sigla}
              >
                {s.sigla}
              </text>
              <text
                x={s.cx}
                y={s.cy + 14}
                textAnchor="middle"
                className={styles.count}
              >
                {n}
              </text>
            </g>
          )
        })}
      </svg>

      <div className={styles.legend}>
        <span className={styles.legendLabel}>Menos</span>
        <div className={styles.legendBar}>
          {[0.15, 0.35, 0.55, 0.75, 1].map((v) => (
            <span
              key={v}
              className={styles.legendStop}
              style={{ background: `rgba(${BASE}, ${v})` }}
            />
          ))}
        </div>
        <span className={styles.legendLabel}>Mais</span>
      </div>
    </div>
  )
}
