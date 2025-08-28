import { Analytics } from '@vercel/analytics/react';

export const metadata = {
  title: 'Game Hub',
  description: 'Collection of fun brain games',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
