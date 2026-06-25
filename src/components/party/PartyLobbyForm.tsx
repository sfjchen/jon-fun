'use client'

import { PARTY_NAME_MAX_LEN } from '@/lib/party/constants'

const fieldStyle = {
  borderColor: 'var(--ink-border)',
  backgroundColor: 'var(--ink-bg)',
  color: 'var(--ink-text)',
} as const

type PartyLobbyFormProps = {
  nameInput: string
  setNameInput: (v: string) => void
  pinInput: string
  setPinInput: (v: string) => void
  onCreate: () => void
  onJoin: () => void
  loading: boolean
  clientReady: boolean
  error: string | null
  /** compact = single name field; labeled = Name label + wider layout (Quip Clash) */
  variant?: 'compact' | 'labeled'
  createLabel?: string
  className?: string
}

export default function PartyLobbyForm({
  nameInput,
  setNameInput,
  pinInput,
  setPinInput,
  onCreate,
  onJoin,
  loading,
  clientReady,
  error,
  variant = 'compact',
  createLabel = 'Create',
  className = 'max-w-md',
}: PartyLobbyFormProps) {
  const cardStyle = {
    backgroundColor: 'var(--ink-paper)',
    borderColor: 'var(--ink-border)',
    color: 'var(--ink-text)',
  } as const

  const nameField = (
    <input
      value={nameInput}
      onChange={(e) => setNameInput(e.target.value)}
      maxLength={PARTY_NAME_MAX_LEN}
      placeholder={variant === 'labeled' ? 'Your name' : 'Name'}
      className="w-full rounded border px-3 py-2"
      style={fieldStyle}
    />
  )

  const pinRow = (
    <div className="flex gap-2">
      <input
        value={pinInput}
        onChange={(e) => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
        maxLength={4}
        placeholder="PIN"
        className="flex-1 rounded border px-3 py-2"
        style={fieldStyle}
      />
      <button
        type="button"
        onClick={onJoin}
        disabled={loading || !clientReady}
        className="px-3 py-2 rounded text-white"
        style={{ backgroundColor: 'var(--ink-accent)' }}
      >
        Join
      </button>
    </div>
  )

  return (
    <aside className={`rounded-lg border p-4 shadow-sm ${className}`} style={cardStyle}>
      <div className="space-y-3">
        {variant === 'labeled' ? (
          <div className="space-y-4">
            <div>
              <div className="text-sm mb-1" style={{ color: 'var(--ink-muted)' }}>
                Name
              </div>
              {nameField}
            </div>
            {pinRow}
          </div>
        ) : (
          <>
            {nameField}
            {pinRow}
          </>
        )}
        <button
          type="button"
          onClick={onCreate}
          disabled={loading || !clientReady}
          className="w-full py-2 rounded text-white"
          style={{ backgroundColor: 'rgb(22 101 52)' }}
        >
          {createLabel}
        </button>
        {error && (
          <div className="text-sm text-red-600" data-testid="party-error">
            {error}
          </div>
        )}
      </div>
    </aside>
  )
}
