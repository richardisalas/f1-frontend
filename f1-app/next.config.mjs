/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['localhost', 'f1-frontend-mu.vercel.app'],
    unoptimized: true,
  },
  // Optional: Set reactStrictMode if needed
  // reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization, X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Date, X-Api-Version' },
          { key: 'Access-Control-Max-Age', value: '86400' },
        ],
      },
    ]
  }
}

export default nextConfig 