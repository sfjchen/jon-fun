'use client'

type StatusBarProps = {
  chars: number
  flags: number
  actions: number
  syncOk: boolean | null
  saving: boolean
}

export default function StatusBar({ chars, flags, actions, syncOk, saving }: StatusBarProps) {
  let syncLabel = ''
  if (saving) syncLabel = 'Saving…'
  else if (syncOk === false) syncLabel = 'Local only (cloud sync off)'
  else if (syncOk === true) syncLabel = 'Saved'

  return (
    <footer
      className="flex h-7 shrink-0 items-center gap-3 border-t border-[var(--uv-border)] bg-[var(--uv-bg-sidebar)] px-4 text-[11px] text-[var(--uv-text-secondary)]"
      data-testid="notes-statusbar"
    >
      <span>{chars} chars</span>
      <span>{flags} lookups</span>
      <span>{actions} todos</span>
      {syncLabel ? (
        <span
          className={syncOk === false ? 'text-amber-800' : 'text-[var(--uv-text-muted)]'}
          title={syncOk === false ? 'Notes stay on this device until Supabase migration is applied' : undefined}
        >
          {syncLabel}
        </span>
      ) : null}
      <span className="ml-auto hidden sm:inline">Paste screenshot · Ctrl+K decode</span>
    </footer>
  )
}
