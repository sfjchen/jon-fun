import type { Metadata } from 'next'
import { Lato } from 'next/font/google'
import './notes.css'

const lato = Lato({
  subsets: ['latin'],
  weight: ['300', '400', '700'],
  variable: '--font-lato',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Notes',
  description: 'AI note companion — shorthand, ? lookups, multi-session history',
}

export default function UvimcoNotesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${lato.variable} uvimco-notes-layout font-[family-name:var(--font-lato)]`}>
      {children}
    </div>
  )
}
