/** @type {import('next').NextConfig} */
const nextConfig = {
  /** `pdf-parse` pulls pdf.js; keep it external so the API route loads the real package (avoids bundler defineProperty errors). */
  serverExternalPackages: ['pdf-parse', 'pdfjs-dist'],
  /**
   * pdf.js loads `pdf.worker.mjs` via dynamic import; Next/Vercel file tracing can omit it from the
   * serverless bundle, causing "pdf.worker.mjs not found" at runtime. Force-include the worker build.
   */
  outputFileTracingIncludes: {
    '/api/reader/extract-pdf': [
      './node_modules/pdfjs-dist/legacy/build/**/*',
      './node_modules/pdf-parse/node_modules/pdfjs-dist/legacy/build/**/*',
    ],
    // Bundle curated Jeopardy boards so the passcode-gated library can read them at runtime on Vercel.
    '/api/jeopardy/library': ['./data/jeopardy/**/*'],
    '/api/jeopardy/library/[filename]/import': ['./data/jeopardy/**/*'],
  },
  /** Playwright uses 127.0.0.1:PLAYWRIGHT_WEB_PORT; Next dev defaults to localhost — allow dev HMR (Hot Module Replacement) fetches. */
  allowedDevOrigins: ['127.0.0.1'],
  /** Hide the Next.js dev indicator in `next dev` when `PLAYWRIGHT_HIDE_NEXT_INDICATOR=1` so visual-regression snapshots don't capture it. */
  devIndicators: process.env.PLAYWRIGHT_HIDE_NEXT_INDICATOR === '1' ? false : undefined,
  async redirects() {
    return [
      { source: '/notebook', destination: '/', permanent: true },
      { source: '/notebook/:path*', destination: '/:path*', permanent: true },
      { source: '/Madelyn-Patrick', destination: '/wedding/madelyn-patrick', permanent: true },
      { source: '/Madelyn-Patrick/:path*', destination: '/wedding/madelyn-patrick', permanent: true },
      { source: '/games/uvimco-notes', destination: '/games/notes', permanent: true },
      { source: '/games/uvimco-notes/:path*', destination: '/games/notes/:path*', permanent: true },
      { source: '/api/uvimco-notes/:path*', destination: '/api/notes/:path*', permanent: true },
      { source: '/admin/uvimco-notes', destination: '/admin/notes', permanent: true },
    ]
  },
  async rewrites() {
    const origin = process.env.VERIDIAN_ORIGIN ?? 'https://veridian-whiteboard.vercel.app'
    return {
      beforeFiles: [
        { source: '/veridian', destination: `${origin}/veridian` },
        { source: '/veridian/:path*', destination: `${origin}/veridian/:path*` },
      ],
    }
  },
  experimental: {
    optimizePackageImports: ['@vercel/analytics'],
  },
  images: {
    formats: ['image/webp', 'image/avif'],
  },
  compress: true,
  poweredByHeader: false,
}

export default nextConfig
