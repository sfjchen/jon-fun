'use client'

type StatusBarProps = {
  chars: number
  flags: number
  actions: number
}

export default function StatusBar({ chars, flags, actions }: StatusBarProps) {
  return (
    <footer className="flex h-7 shrink-0 items-center gap-4 border-t border-[var(--uv-border)] bg-[var(--uv-bg-sidebar)] px-4 text-[10px] text-[var(--uv-text-secondary)]">
      <span>{chars} chars</span>
      <span>{flags} ?flags</span>
      <span>{actions} actions</span>
      <span className="ml-auto hidden sm:inline">Paste screenshot · Ctrl+K decode all</span>
    </footer>
  )
}
