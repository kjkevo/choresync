import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
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
