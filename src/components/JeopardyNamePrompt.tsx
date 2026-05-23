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
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-60">
      <div className="w-full max-w-md rounded-lg border shadow-lg p-6" style={{ backgroundColor: 'var(--ink-paper)', borderColor: 'var(--ink-border)' }}>
        <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--ink-text)' }}>What&apos;s your name?</h2>
        <p className="text-sm mb-4" style={{ color: 'var(--ink-muted)' }}>So your friends can see who is editing what.</p>
        <input
          ref={ref}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
          placeholder="e.g. Alex"
          maxLength={40}
          className="w-full px-3 py-2 rounded-lg border outline-none"
          style={{ backgroundColor: 'var(--ink-bg)', borderColor: 'var(--ink-border)', color: 'var(--ink-text)' }}
        />
        <div className="flex justify-end gap-2 mt-4">
          {onSkip && (
            <button onClick={onSkip} className="px-3 py-2 rounded-lg border" style={{ borderColor: 'var(--ink-border)', color: 'var(--ink-muted)' }}>Skip</button>
          )}
          <button onClick={submit} className="px-4 py-2 rounded-lg text-white" style={{ backgroundColor: 'var(--ink-accent)' }}>Continue</button>
        </div>
      </div>
    </div>
  )
}
