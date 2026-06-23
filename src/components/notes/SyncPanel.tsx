'use client'

import { useState } from 'react'
import {
  getEffectiveUserId,
  getOrCreateUserId,
  getSyncKey,
  restoreFromServer,
  setSyncKey,
  syncWithServer,
} from '@/lib/notes/storage'

type SyncPanelProps = {
  onSynced: (opts?: { skipPersist?: boolean }) => void
}

/** Sync / restore controls — shown inside collapsed "Sync & backup" section. */
export default function SyncPanel({ onSynced }: SyncPanelProps) {
  const [syncKeyInput, setSyncKeyInput] = useState(() => getSyncKey())
  const [restoreKey, setRestoreKey] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSaveSync() {
    setBusy(true)
    setStatus(null)
    setSyncKey(syncKeyInput.trim())
    const r = await syncWithServer()
    setBusy(false)
    setStatus(r.pushOk ? 'Synced' : 'Sync failed — saved locally')
    onSynced()
  }

  async function handleRestore() {
    setBusy(true)
    setStatus(null)
    const { restored, error } = await restoreFromServer(restoreKey)
    setBusy(false)
    if (error) setStatus(error)
    else if (restored > 0) {
      setSyncKeyInput(restoreKey.trim())
      setStatus(`Restored ${restored} note(s)`)
      onSynced({ skipPersist: true })
    } else setStatus('No notes found')
  }

  function copyDeviceId() {
    void navigator.clipboard.writeText(getOrCreateUserId())
    setStatus('Device ID copied')
  }

  return (
    <div className="px-3 pb-3" data-testid="notes-sync-panel">
      <p className="mb-2 text-[11px] text-[var(--uv-text-secondary)]">
        Same sync key on all devices merges notes. Restore if you cleared browser data.
      </p>
      <label className="mb-1 block text-[10px] text-[var(--uv-text-muted)]">Sync key</label>
      <div className="mb-2 flex gap-1">
        <input
          value={syncKeyInput}
          onChange={(e) => setSyncKeyInput(e.target.value)}
          placeholder="e.g. jon123"
          data-testid="notes-sync-key-input"
          className="min-w-0 flex-1 rounded border border-[var(--uv-border)] bg-[var(--uv-bg-elevated)] px-2 py-1 text-xs"
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => void handleSaveSync()}
          data-testid="notes-sync-save"
          className="shrink-0 rounded bg-[var(--uv-accent)] px-2 py-1 text-[11px] text-white disabled:opacity-50"
        >
          Save & Sync
        </button>
      </div>
      <label className="mb-1 block text-[10px] text-[var(--uv-text-muted)]">Restore key / user ID</label>
      <div className="mb-2 flex gap-1">
        <input
          value={restoreKey}
          onChange={(e) => setRestoreKey(e.target.value)}
          placeholder="Sync key or device ID"
          data-testid="notes-restore-key-input"
          className="min-w-0 flex-1 rounded border border-[var(--uv-border)] bg-[var(--uv-bg-elevated)] px-2 py-1 text-xs"
        />
        <button
          type="button"
          disabled={busy || !restoreKey.trim()}
          onClick={() => void handleRestore()}
          data-testid="notes-restore-btn"
          className="shrink-0 rounded border border-[var(--uv-border)] px-2 py-1 text-[11px] disabled:opacity-50"
        >
          Restore
        </button>
      </div>
      <button
        type="button"
        onClick={copyDeviceId}
        className="text-[10px] text-[var(--uv-accent)] hover:underline"
        title={getOrCreateUserId()}
      >
        Copy device ID ({getEffectiveUserId().slice(0, 8)}…)
      </button>
      {status ? <p className="mt-2 text-[11px] text-[var(--uv-text-secondary)]">{status}</p> : null}
    </div>
  )
}
