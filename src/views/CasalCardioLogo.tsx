import styles from './CasalCardioLogo.module.css'

interface Props {
  size?: number
}

/**
 * Marca tipográfica do CasalCardioApp com um arco em vermelho-cereja.
 * O SVG fica no código para funcionar também offline e em telas pequenas.
 */
export default function CasalCardioLogo({ size = 32 }: Props) {
  const h = size
  return (
    <div className={styles.wrapper} style={{ height: h }}>
      <svg
        viewBox="0 0 300 70"
        height={h}
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="CasalCardioApp"
      >
        {/* Arco vermelho sobre o nome */}
        <path
          d="M 12 28 Q 62 -2 112 28"
          fill="none"
          stroke="var(--casal-red-bright)"
          strokeWidth="6"
          strokeLinecap="round"
        />
        {/* Nome do produto */}
        <text
          x="0"
          y="58"
          fontSize="37"
          fontWeight="700"
          fontFamily="Sora, sans-serif"
          fill="var(--casal-red-deep)"
          letterSpacing="-1"
        >
          Casal
        </text>
        {/* Segunda parte da marca */}
        <text
          x="116"
          y="58"
          fontSize="26"
          fontWeight="500"
          fontFamily="Sora, sans-serif"
          fill="var(--casal-red)"
        >
          CardioApp
        </text>
      </svg>
    </div>
  )
}
