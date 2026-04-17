/** @type {import('next').NextConfig} */
const nextConfig = {
  /** `pdf-parse` pulls pdf.js; keep it external so the API route loads the real package (avoids bundler defineProperty errors). */
  serverExternalPackages: ['pdf-parse', 'pdfjs-dist'],
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
