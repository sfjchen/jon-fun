import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '5 Can Sorting',
  description: 'Swap cans into the hidden order using only positional count feedback.',
}

export default function FiveCanSortingLayout({ children }: { children: React.ReactNode }) {
  return children
}
