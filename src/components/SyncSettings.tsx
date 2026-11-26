'use client'

/**
 * Shared sync controls for every synced app: 1 sync key for the whole site and this device's name.
 * The app passes its own merge as onSync.
 */
import { useEffect, useState } from 'react'
import PlayerName from '@/components/PlayerName'
import {
  connectSyncKey,
  ensureSyncIdentity,
  getDevicePlayer,
  getLinkedDevices,
  getSyncKey,
  saveDevicePlayer,
  SYNC_IDENTITY_CHANGED,
  type LinkedDevice,
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
 * Says how long before `now` a device last linked, in its largest whole unit.
 */
function ago(iso: string, now: number): string {
  const min = Math.max(0, Math.round((now - Date.parse(iso)) / 60000))
  if (min < 2) return 'just now'
  if (min < 60) return `${min} min ago`
  return min < 1440 ? `${Math.round(min / 60)} h ago` : `${Math.round(min / 1440)} d ago`
}

/**
 * Renders the sync key form, this device's name and the other devices on the key.
 */
export default function SyncSettings({ onSync, testIdPrefix: t }: Props) {
  const [keyInput, setKeyInput] = useState(() => getSyncKey())
  const [linked, setLinked] = useState<{ devices: LinkedDevice[]; now: number }>({ devices: [], now: 0 })
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null)

  useEffect(() => {
    // A key restored from the server after load fills the empty field, so it matches the "synced" status.
    const bump = () => {
      setLinked({ devices: getLinkedDevices(), now: Date.now() })
      setKeyInput((v) => v || getSyncKey())
    }
    window.addEventListener(SYNC_IDENTITY_CHANGED, bump)
    // A link that finished before this form opened fired its event already, so the form reads the result itself.
    void ensureSyncIdentity().then(bump)
    return () => window.removeEventListener(SYNC_IDENTITY_CHANGED, bump)
  }, [])

  const key = getSyncKey()
  const me = getDevicePlayer()
  // Another device on the key that plays under a different name, whose daily games this device would not share.
  const other = linked.devices.find((d) => d.name && d.name.toLowerCase() !== me?.name.toLowerCase())

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

  const btn = 'shrink-0 rounded px-3 py-1.5 text-sm disabled:opacity-50'
  return (
    <div data-testid={`${t}-sync-settings`} style={{ color: C.text }}>
      <p className="mb-3 text-sm" style={{ color: C.muted }}>
        Make up a sync key and type the same one on each phone and computer. It carries your name, your daily games,
        this log and your notes. Both sides are merged and the latest edit is kept, on every load and save. Anyone who
        knows the key can use it, so make it hard to guess.
      </p>
      <div className="mb-3 flex gap-2">
        <input
          value={keyInput}
          onChange={(e) => setKeyInput(e.target.value)}
          placeholder="Sync key"
          aria-label="Sync key"
          maxLength={200}
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
      <div className="space-y-1 text-sm" data-testid={`${t}-device-status`}>
        <p className="flex items-center gap-1">
          Name: <PlayerName />
        </p>
        <p style={{ color: C.muted }}>
          {!key
            ? 'No sync key yet. This device keeps its own copy.'
            : linked.devices.length
              ? `Synced with ${linked.devices.map((d) => `${d.kind ?? 'device'} (${ago(d.lastSeen, linked.now)})`).join(', ')}.`
              : 'Synced. No other device uses this key yet, so type it on your other device.'}
        </p>
        {key && other && (
          <p>
            Your {other.kind ?? 'other device'} plays as {other.name}.{' '}
            <button
              type="button"
              className="underline"
              data-testid={`${t}-use-name`}
              onClick={() => saveDevicePlayer({ name: other.name, group: other.group })}
            >
              Play as {other.name} here
            </button>
          </p>
        )}
      </div>
    </div>
  )
}
