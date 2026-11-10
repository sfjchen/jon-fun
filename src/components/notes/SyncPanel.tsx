'use client'

/**
 * Notes sync section: the site-wide SyncSettings plus a local vault reset.
 */
import SyncSettings from '@/components/SyncSettings'
import { resetLocalNotesVault, syncWithServer } from '@/lib/notes/storage'

type SyncPanelProps = {
  onSynced: (opts?: { skipPersist?: boolean; force?: boolean; reloadLocal?: boolean }) => void
}

/**
 * Renders sync controls inside the collapsed "Sync & backup" section.
 */
export default function SyncPanel({ onSynced }: SyncPanelProps) {
  return (
    <div className="px-3 pb-3 text-xs" data-testid="notes-sync-panel">
      <SyncSettings
        testIdPrefix="notes"
        onSync={async () => {
          const r = await syncWithServer()
          onSynced({ force: true })
          return r.pushOk ? { ok: true, message: 'Synced' } : { ok: false, message: r.pushError ?? 'Sync failed, saved locally' }
        }}
      />
      <button
        type="button"
        onClick={() => {
          resetLocalNotesVault()
          onSynced({ reloadLocal: true })
        }}
        data-testid="notes-clear-local-vault"
        className="mt-3 block text-[10px] text-[var(--uv-text-muted)] hover:text-red-400"
      >
        Clear local vault
      </button>
    </div>
  )
}
