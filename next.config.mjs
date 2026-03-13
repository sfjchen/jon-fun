/** @type {import('next').NextConfig} */
const nextConfig = {
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
