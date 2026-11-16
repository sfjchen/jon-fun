import type { Metadata } from 'next'
import { HomeLink } from '@/components/HomeLink'

export const metadata: Metadata = { title: 'Anthropeum' }

const SRC = 'https://anthropeum.com/'

/** Frames the official Anthropeum game unmodified so it plays inside the home-screen app. */
export default function AnthropeumPage() {
  return (
    <>
      <iframe
        src={SRC}
        title="Anthropeum"
        allow="clipboard-write; web-share; fullscreen"
        className="min-h-0 w-full flex-1 border-0"
      />
      <div
        className="pb-safe flex h-8 flex-none items-center justify-between border-t px-2"
        style={{ backgroundColor: 'var(--ink-paper)', borderColor: 'var(--ink-border)' }}
      >
        <HomeLink />
        <a href={SRC} target="_blank" rel="noopener noreferrer" className="px-2 text-sm" style={{ color: 'var(--ink-muted)' }}>
          anthropeum.com ↗
        </a>
      </div>
    </>
  )
}
