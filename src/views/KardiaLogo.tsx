import styles from './KardiaLogo.module.css'

interface Props {
  size?: number
}

/**
 * Marca tipográfica do Kardia App com um arco em vermelho-cereja.
 * O SVG fica no código para funcionar também offline e em telas pequenas.
 */
export default function KardiaLogo({ size = 32 }: Props) {
  const h = size
  return (
    <div className={styles.wrapper} style={{ height: h }}>
      <svg
        viewBox="0 0 260 70"
        height={h}
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Kardia App"
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
          Kardia
        </text>
        {/* Segunda parte da marca */}
        <text
          x="142"
          y="58"
          fontSize="26"
          fontWeight="500"
          fontFamily="Sora, sans-serif"
          fill="var(--casal-red)"
        >
          App
        </text>
      </svg>
    </div>
  )
}
