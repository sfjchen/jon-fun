import type { Metadata } from 'next'

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://sfjc.dev'),
}

export default function WeddingLayout({ children }: { children: React.ReactNode }) {
  return children
}
