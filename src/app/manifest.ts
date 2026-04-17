import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'sfjc.dev Reader',
    short_name: 'sfjc Reader',
    description: 'Local-first web reader for importing text and PDF files into a chapterized reading experience.',
    start_url: '/games/e-reader',
    display: 'standalone',
    background_color: '#f7f5f1',
    theme_color: '#2f81f7',
    icons: [
      {
        src: '/icon.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
