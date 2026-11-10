'use client'

/**
 * Shared sync controls for every synced app: 1 sync key for the whole site, this device's approval state, and
 * approve / remove buttons for the key's other devices. The app passes its own merge as onSync.
 */
import { useEffect, useState } from 'react'
import {
  connectSyncKey,
  ensureSyncIdentity,
  getDeviceId,
  getDeviceLabel,
  getLinkedDevices,
  getSyncKey,
  isDeviceApproved,
  setDeviceApproval,
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
 * Renders the sync key form, device status and the approval list.
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
  const approved = isDeviceApproved()
  const me = getDeviceId()
  const others = getLinkedDevices().filter((d) => d.deviceId !== me)

  /**
   * Links the typed key, then runs the app's merge when this device is approved.
   */
  async function handleSync() {
    setBusy(true)
    setStatus(null)
    const ok = await connectSyncKey(keyInput)
    setStatus(ok ? await onSync() : { ok: false, message: 'Waiting for approval from another device' })
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
        {!key ? 'not synced (local only)' : approved ? 'approved' : 'waiting for approval'}
      </p>
      {key && !approved && (
        <p className="mt-1 text-sm text-amber-600">
          Open Sync on a browser already using this key and approve this device. Until then entries stay on this
          browser and upload once approved.
        </p>
      )}
      {approved && others.length > 0 && (
        <ul className="mt-3 space-y-1 border-t pt-2 text-sm" style={{ borderColor: C.border }}>
          {others.map((d) => (
            <li key={d.deviceId} className="flex items-center gap-2" data-testid={`${t}-linked-device`}>
              <span className="min-w-0 flex-1 truncate">
                {d.label || 'Unnamed'}{' '}
                <span style={{ color: C.muted }}>
                  · {d.approved ? 'approved' : 'waiting'} · {new Date(d.lastSeen).toLocaleDateString()}
                </span>
              </span>
              {!d.approved && (
                <button type="button" className={`${btn} text-white`} style={{ background: C.accent }}
                  onClick={() => void setDeviceApproval(d.deviceId, true)}>
                  Approve
                </button>
              )}
              <button type="button" className={`${btn} border`} style={{ borderColor: C.border }}
                onClick={() => void setDeviceApproval(d.deviceId, false)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
