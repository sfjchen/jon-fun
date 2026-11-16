import type { Metadata } from 'next'
import { ScoreStrip } from '@/components/Scores'

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
      <ScoreStrip source={SRC} />
    </>
  )
}
