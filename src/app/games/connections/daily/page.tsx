import type { Metadata } from 'next'
import { Suspense } from 'react'
import ConnectionsDaily from '@/components/connections/ConnectionsDaily'

export const metadata: Metadata = { title: 'Daily Connections', description: 'A new 16-word Connections puzzle every day, with an archive.' }

export default function ConnectionsDailyPage() {
  return (
    <Suspense>
      <ConnectionsDaily />
    </Suspense>
  )
}
