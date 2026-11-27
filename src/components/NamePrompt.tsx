'use client'

/**
 * Asks a visitor with no name for one, at the top of every page that plays or syncs under the name. It sits in the
 * page flow and never covers the game, so the page stays playable as a guest, and "Not now" hides it for the visit.
 */

import { useEffect, useState } from 'react'
import { PUBLIC_GROUP, setPlayer } from '@/lib/results'
import { ensureSyncIdentity } from '@/lib/syncIdentity'
import { usePlayer } from '@/lib/use-player'

const SKIPPED = 'sfjc_name_prompt_skipped'

/**
 * Renders the prompt once the saved name has had its chance to come back with the device cookie.
 */
export default function NamePrompt() {
  const player = usePlayer()
  const [show, setShow] = useState(false)
  const [draft, setDraft] = useState('')
  useEffect(() => {
    let live = true
    void ensureSyncIdentity().finally(() => live && setShow(sessionStorage.getItem(SKIPPED) !== '1'))
    return () => {
      live = false
    }
  }, [])
  if (!show || player) return null
  return (
    <form
      data-testid="name-prompt"
      className="mx-auto mb-3 flex w-full max-w-4xl flex-none flex-wrap items-center gap-2 rounded-xl border border-[var(--ink-border)] bg-[var(--ink-paper)] px-3 py-2 text-sm text-[var(--ink-text)]"
      onSubmit={(e) => {
        e.preventDefault()
        if (draft.trim()) setPlayer({ name: draft.trim(), group: PUBLIC_GROUP })
      }}
    >
      <p className="mr-auto">Add your name to save scores and play with friends. You are a guest until then.</p>
      <input
        aria-label="Name to play as"
        autoComplete="nickname"
        autoCapitalize="words"
        maxLength={24}
        required
        placeholder="Your name"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        className="w-36 min-w-0 rounded border border-[var(--ink-border)] bg-[var(--ink-bg)] px-2 py-1"
      />
      <button type="submit" className="rounded border border-[var(--ink-border)] px-3 py-1 font-semibold">
        Save name
      </button>
      <button
        type="button"
        className="px-1 py-1 underline"
        onClick={() => {
          sessionStorage.setItem(SKIPPED, '1')
          setShow(false)
        }}
      >
        Not now
      </button>
    </form>
  )
}
