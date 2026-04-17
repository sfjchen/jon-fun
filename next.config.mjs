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
  },
  /** Playwright uses 127.0.0.1:PLAYWRIGHT_WEB_PORT; Next dev defaults to localhost — allow dev HMR (Hot Module Replacement) fetches. */
  allowedDevOrigins: ['127.0.0.1'],
  async redirects() {
    return [{ source: '/notebook', destination: '/', permanent: true }, { source: '/notebook/:path*', destination: '/:path*', permanent: true }]
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
