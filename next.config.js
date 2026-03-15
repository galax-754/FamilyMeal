/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: '*.googleusercontent.com' },
      { protocol: 'https', hostname: '*.blogspot.com' },
      { protocol: 'https', hostname: '*.wordpress.com' },
      { protocol: 'https', hostname: '*.kiwilimon.com' },
      { protocol: 'https', hostname: '**' },
    ],
  },
}

module.exports = nextConfig
