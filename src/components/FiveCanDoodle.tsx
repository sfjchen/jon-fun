/**
 * Simple line-art soda can doodles (parody / generic — not official brand assets).
 * ids: 0 red cola, 1 blue cola, 2 dr.-style, 3 lime citrus, 4 orange soda.
 */
export function FiveCanDoodle({ canId, className }: { canId: number; className?: string }) {
  const stroke = '#1a1a1a'
  const common = {
    xmlns: 'http://www.w3.org/2000/svg',
    className,
    viewBox: '0 0 56 88',
    fill: 'none' as const,
    stroke,
    strokeWidth: 2.2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }

  switch (canId) {
    case 0:
      return (
        <svg {...common} aria-hidden>
          <ellipse cx="28" cy="14" rx="18" ry="7" fill="#e8e4df" stroke={stroke} />
          <path d="M10 14v58c0 6 8 10 18 10s18-4 18-10V14" fill="#d62828" stroke={stroke} />
          <path d="M12 38h32" stroke="#faf6f0" strokeWidth="3" />
          <path d="M16 32c4-2 8-2 12 0s8 2 12 0" stroke="#faf6f0" strokeWidth="1.8" fill="none" />
          <ellipse cx="28" cy="78" rx="18" ry="7" fill="#c4bfb8" stroke={stroke} />
        </svg>
      )
    case 1:
      return (
        <svg {...common} aria-hidden>
          <ellipse cx="28" cy="14" rx="18" ry="7" fill="#e8e4df" stroke={stroke} />
          <path d="M10 14v58c0 6 8 10 18 10s18-4 18-10V14" fill="#0047ab" stroke={stroke} />
          <circle cx="28" cy="44" r="10" fill="#c41e3a" stroke={stroke} strokeWidth="2" />
          <path d="M22 44h12M28 38v12" stroke="#faf6f0" strokeWidth="2" />
          <path d="M14 28h28" stroke="#faf6f0" strokeWidth="3" />
          <ellipse cx="28" cy="78" rx="18" ry="7" fill="#c4bfb8" stroke={stroke} />
        </svg>
      )
    case 2:
      return (
        <svg {...common} aria-hidden>
          <ellipse cx="28" cy="14" rx="18" ry="7" fill="#e8e4df" stroke={stroke} />
          <path d="M10 14v58c0 6 8 10 18 10s18-4 18-10V14" fill="#6b2d2d" stroke={stroke} />
          <path d="M14 34h28v16H14z" fill="#4a1515" stroke={stroke} strokeWidth="2" />
          <path d="M18 40h20M18 46h16" stroke="#e8d5c4" strokeWidth="1.6" />
          <ellipse cx="28" cy="78" rx="18" ry="7" fill="#c4bfb8" stroke={stroke} />
        </svg>
      )
    case 3:
      return (
        <svg {...common} aria-hidden>
          <ellipse cx="28" cy="14" rx="18" ry="7" fill="#e8e4df" stroke={stroke} />
          <path d="M10 14v58c0 6 8 10 18 10s18-4 18-10V14" fill="#00a651" stroke={stroke} />
          <circle cx="28" cy="42" r="8" fill="#ffde59" stroke={stroke} strokeWidth="2" />
          <path d="M28 36v12M22 42h12" stroke="#1a1a1a" strokeWidth="1.5" />
          <path d="M16 58c4 2 8 2 12 0" stroke="#b8e6cf" strokeWidth="2" fill="none" />
          <ellipse cx="28" cy="78" rx="18" ry="7" fill="#c4bfb8" stroke={stroke} />
        </svg>
      )
    case 4:
      return (
        <svg {...common} aria-hidden>
          <ellipse cx="28" cy="14" rx="18" ry="7" fill="#e8e4df" stroke={stroke} />
          <path d="M10 14v58c0 6 8 10 18 10s18-4 18-10V14" fill="#ff7900" stroke={stroke} />
          <circle cx="28" cy="44" r="11" fill="#ffb347" stroke={stroke} strokeWidth="2" />
          <path d="M22 40c2 4 4 6 6 8M30 40c-2 4-4 6-6 8" stroke="#d9480f" strokeWidth="1.5" fill="none" />
          <ellipse cx="28" cy="78" rx="18" ry="7" fill="#c4bfb8" stroke={stroke} />
        </svg>
      )
    default:
      return (
        <svg {...common} aria-hidden>
          <rect x="12" y="12" width="32" height="64" rx="6" fill="#ccc" stroke={stroke} />
        </svg>
      )
  }
}
