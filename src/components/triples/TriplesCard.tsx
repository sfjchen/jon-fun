/**
 * Draws one Triples card: 1-3 copies of a oval, diamond or squiggle, in green, red or purple, filled solid,
 * striped or outlined.
 */

import { features } from '@/lib/triples'

export const COLORS = ['#00823b', '#dc1935', '#72268d']
const COLOR_NAMES = ['green', 'red', 'purple']
const SHAPE_NAMES = ['oval', 'diamond', 'squiggle']
const FILL_NAMES = ['solid', 'striped', 'outlined']

/**
 * Describes a card in words for screen readers and hover text, like "2 striped red diamonds".
 */
export function cardLabel(card: number): string {
  const [n, s, c, f] = features(card)
  return `${n + 1} ${FILL_NAMES[f]} ${COLOR_NAMES[c]} ${SHAPE_NAMES[s]}${n ? 's' : ''}`
}

/**
 * Draws 1 shape centered at x.
 */
function Shape({ shape, x, fill, stroke }: { shape: number; x: number; fill: string; stroke: string }) {
  const p = { fill, stroke, strokeWidth: 3.5, strokeLinejoin: 'round' as const }
  if (shape === 0) return <rect x={x - 13} y={22} width={26} height={56} rx={13} {...p} />
  if (shape === 1) return <path d={`M${x} 20 ${x + 17} 50 ${x} 80 ${x - 17} 50 Z`} {...p} />
  return (
    <path
      d={`M${x - 11} 23 C${x + 15} 12 ${x + 22} 35 ${x + 8} 49 C${x - 1} 61 ${x + 23} 64 ${x + 9} 78 C${x - 14} 89 ${x - 24} 66 ${x - 10} 51 C${x + 1} 39 ${x - 24} 37 ${x - 11} 23 Z`}
      {...p}
    />
  )
}

type Props = {
  card: number
  selected: boolean
  hinted?: boolean
  shake?: boolean
  disabled?: boolean
  onPick: (card: number) => void
}

/**
 * Renders the card as a toggle button.
 */
export default function TriplesCard({ card, selected, hinted, shake, disabled, onPick }: Props) {
  const [n, s, c, f] = features(card)
  const color = COLORS[c]!
  const fill = f === 0 ? color : f === 1 ? `url(#tp-stripe-${c})` : 'none'
  const xs = n === 0 ? [75] : n === 1 ? [53, 97] : [31, 75, 119]
  return (
    <button
      data-card={card}
      type="button"
      aria-pressed={selected}
      aria-label={cardLabel(card)}
      title={cardLabel(card)}
      disabled={disabled}
      onClick={() => onPick(card)}
      className="rounded-md border-2 bg-white shadow-sm transition-transform active:scale-95 disabled:cursor-default"
      style={{
        borderColor: selected ? '#1a1a1a' : hinted ? '#ca8a04' : '#e5e2d8',
        boxShadow: selected ? '0 0 0 2px #1a1a1a' : hinted ? '0 0 0 2px #ca8a04' : undefined,
        transform: selected ? 'translateY(-2px)' : undefined,
        animation: shake ? 'tp-shake .2s 2' : undefined,
      }}
    >
      <svg viewBox="0 0 150 100" className="block w-full" aria-hidden>
        {xs.map((x) => (
          <Shape key={x} shape={s} x={x} fill={fill} stroke={color} />
        ))}
      </svg>
    </button>
  )
}

/**
 * Defines the 3 stripe patterns once per page.
 */
export function StripeDefs() {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden>
      <defs>
        {COLORS.map((c, i) => (
          <pattern key={c} id={`tp-stripe-${i}`} width="6" height="6" patternUnits="userSpaceOnUse">
            <rect width="6" height="6" fill="white" />
            <path d="M0 0H6" stroke={c} strokeWidth="2.5" />
          </pattern>
        ))}
      </defs>
    </svg>
  )
}
