import Link from 'next/link'

type HomeLinkProps = {
  /** Header accent (default), Notes workspace, or dark overlay (Chwazi). */
  variant?: 'default' | 'notes' | 'dark'
  className?: string
  'data-testid'?: string
}

function HomeDoodleIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M4 11.5 12 4.5l8 7" />
      <path d="M6.5 11.5V19h11V11.5" />
    </svg>
  )
}

const variantClass: Record<NonNullable<HomeLinkProps['variant']>, string> = {
  default:
    'text-sm hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink-accent)] focus-visible:ring-offset-2 rounded text-[var(--ink-accent)]',
  notes:
    'text-[11px] hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--uv-accent)] focus-visible:ring-offset-1 rounded text-[var(--uv-text-secondary)] hover:text-[var(--uv-accent)]',
  dark: 'text-lg font-semibold text-white/90 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#05070f] rounded min-h-11 min-w-11 py-2 pr-4',
}

/** Standard sfjc.dev home control: ← arrow + doodle house icon. Header: top-right via PageShell. */
export function HomeLink({ variant = 'default', className = '', 'data-testid': testId }: HomeLinkProps) {
  const iconSize = variant === 'dark' ? 'h-5 w-5' : variant === 'notes' ? 'h-3.5 w-3.5' : 'h-4 w-4'

  return (
    <Link
      href="/"
      aria-label="Home"
      data-testid={testId ?? 'home-link'}
      className={`inline-flex shrink-0 items-center gap-1 ${variantClass[variant]} ${className}`}
    >
      <span aria-hidden className="leading-none">
        ←
      </span>
      <HomeDoodleIcon className={`${iconSize} shrink-0`} />
    </Link>
  )
}
