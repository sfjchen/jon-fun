import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'sfjc games',
    short_name: 'sfjc',
    description: 'Games and tools by Jonathan Chen, plus Anthropeum.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#fcf9f4',
    theme_color: '#fcf9f4',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  }
}
