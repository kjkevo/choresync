import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Allow service worker to have proper scope + override Vercel's x-robots-tag
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Service-Worker-Allowed', value: '/' },
          { key: 'Cache-Control', value: 'no-store, max-age=0' },
        ],
      },
      // Override Vercel's deployment-protection x-robots-tag: noindex on
      // production so search engines can index the public pages (login,
      // signup, privacy, terms). App routes behind auth are not crawlable
      // anyway since they redirect to /login.
      {
        source: '/:path*',
        headers: [
          { key: 'X-Robots-Tag', value: 'index, follow' },
        ],
      },
    ]
  },
  images: {
    remotePatterns: [
      // Supabase Storage avatars
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      // Google profile photos (OAuth)
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      // Apple CDN profile photos
      {
        protocol: 'https',
        hostname: 'appleid.cdn-apple.com',
      },
    ],
  },
}

export default nextConfig
