import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Web E-Reader',
  description: 'Import text or PDF files into a chapterized, customizable web reading experience.',
}

export default function Theme2EReaderLayout({ children }: { children: React.ReactNode }) {
  return children
}
