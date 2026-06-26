'use client'

import { useState } from 'react'
import { SFJC_ADMIN_DEVICES } from '@/data/sfjc-admin-devices'
import {
  getDeviceDisplayName,
  getDeviceId,
  getCustomDeviceLabel,
  setCustomDeviceLabel,
} from '@/lib/notes/deviceIdentity'
import {
  getSyncPassword,
  resetLocalNotesVault,
  restoreFromServer,
  setSyncPassword,
  syncWithServer,
} from '@/lib/notes/storage'

type SyncPanelProps = {
  onSynced: (opts?: { skipPersist?: boolean; force?: boolean }) => void
}

/** Sync / restore controls — shown inside collapsed "Sync & backup" section. */
export default function SyncPanel({ onSynced }: SyncPanelProps) {
  const [syncPasswordInput, setSyncPasswordInput] = useState(() => getSyncPassword())
  const [restoreKey, setRestoreKey] = useState('')
  const [deviceLabel, setDeviceLabelInput] = useState(() => getCustomDeviceLabel())
  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const deviceId = getDeviceId()
  const vaultUserId = getSyncPassword()
  const deviceName = getDeviceDisplayName()

  async function handleSaveSync() {
    setBusy(true)
    setStatus(null)
    setSyncPassword(syncPasswordInput.trim())
    const r = await syncWithServer()
    setBusy(false)
    setStatus(r.pushOk ? 'Synced' : 'Sync failed — saved locally')
    onSynced({ force: true })
  }

  async function handleRestore() {
    setBusy(true)
    setStatus(null)
    const { restored, cleared, error } = await restoreFromServer(restoreKey)
    setBusy(false)
    if (error) setStatus(error)
    else if (cleared) {
      setSyncPasswordInput(restoreKey.trim())
      setStatus('Local vault cleared — server is empty')
      onSynced({ skipPersist: true, force: true })
    } else if (restored > 0) {
      setSyncPasswordInput(restoreKey.trim())
      setStatus(`Restored ${restored} note(s)`)
      onSynced({ skipPersist: true, force: true })
    } else setStatus('No notes found')
  }

  function handleClearLocal() {
    resetLocalNotesVault()
    setStatus('Local vault cleared')
    onSynced({ skipPersist: true, force: true })
  }

  function commitDeviceLabel() {
    setCustomDeviceLabel(deviceLabel)
    setStatus('Device name saved')
  }

  function copyDeviceId() {
    void navigator.clipboard.writeText(deviceId)
    setStatus('Device ID copied')
  }

  return (
    <div className="px-3 pb-3" data-testid="notes-sync-panel">
      <p className="mb-2 text-[11px] leading-snug text-[var(--uv-text-muted)]">
        Sync password merges notes across devices. Each browser keeps its own device ID.
      </p>

      <div
        className="mb-3 rounded border border-[var(--uv-border)] bg-[var(--uv-bg-elevated)] px-2 py-2"
        data-testid="notes-device-identity"
      >
        <p className="mb-1 text-[10px] uppercase tracking-wide text-[var(--uv-text-muted)]">This device</p>
        <p className="text-xs font-medium text-[var(--uv-text-primary)]" data-testid="notes-device-name">
          {deviceName}
        </p>
        <p
          className="mt-0.5 font-mono text-[10px] text-[var(--uv-text-muted)]"
          data-testid="notes-device-id"
          title={deviceId}
        >
          {deviceId}
        </p>
        {vaultUserId ? (
          <p className="mt-1 text-[10px] text-[var(--uv-text-muted)]" data-testid="notes-vault-user">
            Shared vault: <span className="font-mono">{vaultUserId}</span>
          </p>
        ) : (
          <p className="mt-1 text-[10px] text-[var(--uv-text-muted)]">Vault: this device only (no sync password)</p>
        )}
        <label className="mt-2 block text-[10px] text-[var(--uv-text-muted)]">Device nickname (optional)</label>
        <div className="mt-0.5 flex gap-1">
          <input
            value={deviceLabel}
            onChange={(e) => setDeviceLabelInput(e.target.value)}
            onBlur={commitDeviceLabel}
            placeholder={deviceName}
            data-testid="notes-device-label-input"
            className="min-w-0 flex-1 rounded border border-[var(--uv-border)] bg-[var(--uv-bg-base)] px-2 py-1 text-xs"
          />
        </div>
        <button
          type="button"
          onClick={copyDeviceId}
          className="mt-2 text-[10px] text-[var(--uv-accent)] hover:underline"
        >
          Copy device ID
        </button>
        <ul className="mt-2 space-y-0.5 border-t border-[var(--uv-border)] pt-2">
          {SFJC_ADMIN_DEVICES.map((d) => (
            <li
              key={d.id}
              className={`text-[10px] ${d.id === deviceId ? 'text-[var(--uv-accent-strong)]' : 'text-[var(--uv-text-muted)]'}`}
              data-testid={`notes-device-registry-${d.id === deviceId ? 'current' : 'other'}`}
            >
              {d.id === deviceId ? '● ' : '○ '}
              {d.label}
              {d.id === deviceId ? ' (this device)' : null}
            </li>
          ))}
        </ul>
      </div>

      <label className="mb-1 block text-[10px] text-[var(--uv-text-muted)]">Sync password</label>
      <div className="mb-2 flex gap-1">
        <input
          value={syncPasswordInput}
          onChange={(e) => setSyncPasswordInput(e.target.value)}
          placeholder="Your sync password"
          data-testid="notes-sync-password-input"
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
      <label className="mb-1 block text-[10px] text-[var(--uv-text-muted)]">Restore password / device ID</label>
      <div className="mb-2 flex gap-1">
        <input
          value={restoreKey}
          onChange={(e) => setRestoreKey(e.target.value)}
          placeholder="Sync password or device ID"
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
        onClick={handleClearLocal}
        data-testid="notes-clear-local-vault"
        className="block text-[10px] text-[var(--uv-text-muted)] hover:text-red-400"
      >
        Clear local vault
      </button>
      {status ? <p className="mt-2 text-[11px] text-[var(--uv-text-secondary)]">{status}</p> : null}
    </div>
  )
}
