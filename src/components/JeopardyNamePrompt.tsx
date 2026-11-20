'use client'

import { useEffect, useRef, useState } from 'react'

interface NamePromptProps {
  initial?: string
  onSubmit: (name: string) => void
  onSkip?: () => void
}

export default function NamePrompt({ initial = '', onSubmit, onSkip }: NamePromptProps) {
  const [name, setName] = useState(initial)
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    ref.current?.focus()
  }, [])

  const submit = () => {
    const trimmed = name.trim()
    if (!trimmed) return onSkip?.()
    onSubmit(trimmed)
  }

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4">
      <div
        className="w-full max-w-md rounded-lg border p-6 shadow-lg"
        style={{ backgroundColor: 'var(--ink-paper)', borderColor: 'var(--ink-border)' }}
      >
        <h2 className="mb-2 text-xl font-bold" style={{ color: 'var(--ink-text)' }}>
          What&apos;s your name?
        </h2>
        <p className="mb-4 text-sm" style={{ color: 'var(--ink-muted)' }}>
          So your friends can see who is editing what.
        </p>
        <input
          ref={ref}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit()
          }}
          placeholder="e.g. Alex"
          maxLength={40}
          className="w-full rounded-lg border px-3 py-2 outline-none"
          style={{ backgroundColor: 'var(--ink-bg)', borderColor: 'var(--ink-border)', color: 'var(--ink-text)' }}
        />
        <div className="mt-4 flex justify-end gap-2">
          {onSkip && (
            <button
              onClick={onSkip}
              className="rounded-lg border px-3 py-2"
              style={{ borderColor: 'var(--ink-border)', color: 'var(--ink-muted)' }}
            >
              Skip
            </button>
          )}
          <button
            onClick={submit}
            className="rounded-lg px-4 py-2 text-white"
            style={{ backgroundColor: 'var(--ink-accent)' }}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  )
}
