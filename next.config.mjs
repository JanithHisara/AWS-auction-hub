/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    const apiOrigin = (
      process.env.API_ORIGIN ||
      (process.env.NODE_ENV === 'production' ? 'http://backend:4000' : `http://127.0.0.1:${process.env.API_PORT || '4000'}`)
    ).replace(/\/$/, '')

    return [
      { source: '/api/:path*', destination: `${apiOrigin}/api/:path*` },
      { source: '/uploads/:path*', destination: `${apiOrigin}/uploads/:path*` },
    ]
  },
}

export default nextConfig
