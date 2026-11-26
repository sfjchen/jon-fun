import type { ReactNode } from 'react'
import { HomeLink } from '@/components/HomeLink'
import { DailyHeader } from '@/components/daily/DailyDrawer'

export default function RoomHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <header className="mb-4 flex min-h-12 items-center gap-2 border-b border-[var(--ink-border)] pb-2">
      <HomeLink className="inline-flex size-10 shrink-0 items-center justify-center" />
      <h1 className="mr-auto font-lora text-xl font-bold sm:text-2xl">{title}</h1>
      {children}
      <DailyHeader compact />
    </header>
  )
}
