'use client'

/**
 * Shared sync controls for every synced app: 1 sync key for the whole site and this device's name.
 * The app passes its own merge as onSync.
 */
import { useEffect, useState } from 'react'
import {
  connectSyncKey,
  ensureSyncIdentity,
  getDeviceLabel,
  getSyncKey,
  setDeviceLabel,
  SYNC_IDENTITY_CHANGED,
} from '@/lib/syncIdentity'

const C = {
  text: 'var(--uv-text-primary, var(--ink-text))',
  muted: 'var(--uv-text-muted, var(--ink-muted))',
  border: 'var(--uv-border, var(--ink-border))',
  bg: 'var(--uv-bg-elevated, var(--ink-bg))',
  accent: 'var(--uv-accent, var(--ink-accent))',
}

type Props = {
  /** Merges the app's data after the key links. Returns the status line to show. */
  onSync: () => Promise<{ ok: boolean; message: string }>
  testIdPrefix: string
}

/**
 * Renders the sync key form and device status.
 */
export default function SyncSettings({ onSync, testIdPrefix: t }: Props) {
  const [keyInput, setKeyInput] = useState(() => getSyncKey())
  const [, setTick] = useState(0)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null)

  useEffect(() => {
    const bump = () => setTick((n) => n + 1)
    window.addEventListener(SYNC_IDENTITY_CHANGED, bump)
    void ensureSyncIdentity()
    return () => window.removeEventListener(SYNC_IDENTITY_CHANGED, bump)
  }, [])

  const key = getSyncKey()

  /**
   * Links the typed key, then runs the app's merge.
   */
  async function handleSync() {
    setBusy(true)
    setStatus(null)
    await connectSyncKey(keyInput)
    setStatus(await onSync())
    setBusy(false)
  }

  /**
   * Prompts for a new device name and saves it.
   */
  async function rename() {
    const next = window.prompt('Name this device', getDeviceLabel())
    if (next !== null) await setDeviceLabel(next)
  }

  const btn = 'shrink-0 rounded px-3 py-1.5 text-sm disabled:opacity-50'
  return (
    <div data-testid={`${t}-sync-settings`} style={{ color: C.text }}>
      <p className="mb-3 text-sm" style={{ color: C.muted }}>
        Use the same sync key on every browser. It covers every app on this site. Sync merges both sides and keeps the
        latest edit, and it runs on every load and save.
      </p>
      <div className="mb-3 flex gap-2">
        <input
          value={keyInput}
          onChange={(e) => setKeyInput(e.target.value)}
          placeholder="Sync key"
          aria-label="Sync key"
          data-testid={`${t}-sync-key-input`}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          className="min-w-0 flex-1 rounded border px-3 py-1.5 text-sm"
          style={{ background: C.bg, borderColor: C.border, color: C.text }}
        />
        <button
          type="button"
          disabled={busy || !keyInput.trim()}
          onClick={() => void handleSync()}
          data-testid={`${t}-sync-button`}
          className={`${btn} text-white`}
          style={{ background: C.accent }}
        >
          {busy ? 'Syncing…' : 'Sync'}
        </button>
      </div>
      {status && (
        <p role="status" className={`mb-3 text-sm ${status.ok ? 'text-green-600' : 'text-amber-600'}`}>
          {status.message}
        </p>
      )}
      <p className="text-sm" data-testid={`${t}-device-status`}>
        This device: <button type="button" onClick={() => void rename()} className="underline">
          {getDeviceLabel() || 'Unnamed'}
        </button>
        {' · '}
        {key ? 'synced' : 'not synced (local only)'}
      </p>
    </div>
  )
}
