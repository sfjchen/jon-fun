'use client'

import { useState } from 'react'
import type { WeddingData } from '@/data/wedding/madelyn-patrick'
import { WeddingSection } from '@/components/wedding/WeddingSection'

type WeddingRsvpFormProps = {
  wedding: WeddingData
}

type FormState = {
  guestName: string
  attending: '' | 'yes' | 'no'
  plusOneName: string
  dietary: string
  email: string
  message: string
}

const initial: FormState = {
  guestName: '',
  attending: '',
  plusOneName: '',
  dietary: '',
  email: '',
  message: '',
}

export function WeddingRsvpForm({ wedding }: WeddingRsvpFormProps) {
  const [form, setForm] = useState<FormState>(initial)
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errMsg, setErrMsg] = useState('')

  const set = (key: keyof FormState, val: string) => setForm((f) => ({ ...f, [key]: val }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.guestName.trim()) {
      setErrMsg('Please enter your name.')
      setStatus('error')
      return
    }
    if (!form.attending) {
      setErrMsg('Please let us know if you can attend.')
      setStatus('error')
      return
    }
    setStatus('loading')
    setErrMsg('')
    try {
      const res = await fetch('/api/wedding/rsvp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guestName: form.guestName.trim(),
          attending: form.attending === 'yes',
          plusOneName: form.plusOneName.trim() || null,
          dietary: form.dietary.trim() || null,
          email: form.email.trim() || null,
          message: form.message.trim() || null,
        }),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) {
        setErrMsg(data.error ?? 'Something went wrong. Please try again.')
        setStatus('error')
        return
      }
      setStatus('success')
      setForm(initial)
    } catch {
      setErrMsg('Network error. Please try again.')
      setStatus('error')
    }
  }

  if (status === 'success') {
    return (
      <WeddingSection id="rsvp" title="RSVP" reveal={false}>
        <div className="border py-12 text-center" style={{ borderColor: 'var(--wedding-border)', backgroundColor: 'var(--wedding-paper)' }}>
          <p className="wedding-eyebrow">Received</p>
          <h3 className="font-wedding-display mt-3 text-2xl font-light">Thank you</h3>
          <p className="mx-auto mt-4 max-w-sm text-sm leading-[1.75]" style={{ color: 'var(--wedding-muted)' }}>
            Your response has been received. We cannot wait to celebrate with you.
          </p>
          <button type="button" className="wedding-btn-ghost mt-8" onClick={() => setStatus('idle')}>
            Submit another
          </button>
        </div>
      </WeddingSection>
    )
  }

  return (
    <WeddingSection id="rsvp" title="RSVP" subtitle={`Please respond by ${wedding.rsvpDeadlineDisplay}`}>
      <form onSubmit={handleSubmit} className="mx-auto max-w-md space-y-6">
        <div>
          <label htmlFor="guestName" className="wedding-label">
            Full name <span style={{ color: 'var(--wedding-accent)' }}>*</span>
          </label>
          <input
            id="guestName"
            type="text"
            required
            autoComplete="name"
            className="wedding-input"
            value={form.guestName}
            onChange={(e) => set('guestName', e.target.value)}
          />
        </div>

        <fieldset>
          <legend className="wedding-label">
            Will you attend? <span style={{ color: 'var(--wedding-accent)' }}>*</span>
          </legend>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {(['yes', 'no'] as const).map((v) => (
              <label
                key={v}
                className="flex min-h-[48px] cursor-pointer items-center justify-center border text-sm transition-colors"
                style={{
                  fontFamily: 'var(--wedding-sans)',
                  letterSpacing: '0.04em',
                  borderColor: form.attending === v ? 'var(--wedding-accent)' : 'var(--wedding-border)',
                  backgroundColor: form.attending === v ? 'var(--wedding-paper)' : '#fff',
                  color: form.attending === v ? 'var(--wedding-text)' : 'var(--wedding-muted)',
                }}
              >
                <input type="radio" name="attending" value={v} className="sr-only" checked={form.attending === v} onChange={() => set('attending', v)} />
                {v === 'yes' ? 'Joyfully accept' : 'Regretfully decline'}
              </label>
            ))}
          </div>
        </fieldset>

        <div>
          <label htmlFor="plusOne" className="wedding-label">
            Plus-one name
          </label>
          <input id="plusOne" type="text" autoComplete="name" className="wedding-input" value={form.plusOneName} onChange={(e) => set('plusOneName', e.target.value)} />
        </div>

        <div>
          <label htmlFor="dietary" className="wedding-label">
            Dietary restrictions
          </label>
          <textarea id="dietary" rows={3} className="wedding-input min-h-[88px] resize-y" value={form.dietary} onChange={(e) => set('dietary', e.target.value)} />
        </div>

        <div>
          <label htmlFor="email" className="wedding-label">
            Email
          </label>
          <input id="email" type="email" autoComplete="email" className="wedding-input" value={form.email} onChange={(e) => set('email', e.target.value)} />
        </div>

        <div>
          <label htmlFor="message" className="wedding-label">
            Message
          </label>
          <textarea id="message" rows={2} className="wedding-input min-h-[72px] resize-y" value={form.message} onChange={(e) => set('message', e.target.value)} />
        </div>

        {status === 'error' && errMsg && (
          <p className="text-sm" style={{ color: '#8c3838' }} role="alert">
            {errMsg}
          </p>
        )}

        <button type="submit" disabled={status === 'loading'} className="wedding-btn-primary w-full disabled:opacity-60">
          {status === 'loading' ? 'Sending…' : 'Send RSVP'}
        </button>
      </form>
    </WeddingSection>
  )
}
