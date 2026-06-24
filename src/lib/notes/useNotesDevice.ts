'use client'

import { useEffect, useState } from 'react'
import { isMacPlatform, isNotesMobileViewport, NOTES_MOBILE_MAX_PX } from './device'

export function useNotesDevice() {
  const [mobile, setMobile] = useState(() =>
    typeof window !== 'undefined' ? isNotesMobileViewport() : false,
  )
  const [mac, setMac] = useState(() => (typeof window !== 'undefined' ? isMacPlatform() : false))

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${NOTES_MOBILE_MAX_PX}px)`)
    const sync = () => {
      setMobile(mq.matches)
      setMac(isMacPlatform())
    }
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  return { isMobile: mobile, isMac: mac, modKey: (mac ? 'Cmd' : 'Ctrl') as 'Cmd' | 'Ctrl' }
}

export { isNotesMobileViewport }
