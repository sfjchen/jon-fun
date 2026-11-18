import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Web E-Reader',
  description: 'Read EPUBs, PDFs and text with chapters, illustrations, notes and customizable typography.',
}

export default function EReaderLayout({ children }: { children: React.ReactNode }) {
  return children
}
