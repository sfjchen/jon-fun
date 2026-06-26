import { useEffect, useState } from 'react'

import { isMacPlatform, modKeyLabel } from '@/lib/notes/device'

export { isMacPlatform, modKeyLabel } from '@/lib/notes/device'

export function isModKey(e: { metaKey: boolean; ctrlKey: boolean }): boolean {
  return e.metaKey || e.ctrlKey
}

export function isModEnter(e: { key: string; metaKey: boolean; ctrlKey: boolean }): boolean {
  return e.key === 'Enter' && isModKey(e)
}

/** Client-safe mod key label (avoids Mac → Ctrl flash during hydration). */
export function useModKeyLabel(): 'Cmd' | 'Ctrl' {
  const [label, setLabel] = useState<'Cmd' | 'Ctrl'>('Ctrl')
  useEffect(() => setLabel(modKeyLabel()), [])
  return label
}

export function modEnterShortcutLabel(mod: 'Cmd' | 'Ctrl' = modKeyLabel()): string {
  return `${mod}+Enter`
}

export function dailyLearnSubmitHint(mod: 'Cmd' | 'Ctrl' = modKeyLabel()): string {
  return `${mod}+Enter to submit · Esc to cancel`
}
