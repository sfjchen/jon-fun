'use client'

type StatusBarProps = {
  chars: number
  flags: number
  actions: number
  syncOk: boolean | null
  saving: boolean
  syncing?: boolean
}

export default function StatusBar({ chars, flags, actions, syncOk, saving, syncing }: StatusBarProps) {
  let syncLabel = ''
  if (syncing) syncLabel = 'Syncing…'
  else if (saving) syncLabel = 'Saving…'
  else if (syncOk === false) syncLabel = 'Local only'
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
          data-testid="notes-sync-label"
          className={syncOk === false && !syncing ? 'text-amber-800' : 'text-[var(--uv-text-muted)]'}
          title={
            syncOk === false && !syncing
              ? 'Cloud sync failed — notes are still saved on this device'
              : undefined
          }
        >
          {syncLabel}
        </span>
      ) : null}
      <span className="ml-auto hidden sm:inline">Paste screenshot · Ctrl+K decode</span>
    </footer>
  )
}
