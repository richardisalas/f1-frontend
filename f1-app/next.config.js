/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: ["*"],
    },
  },
  images: {
    domains: ['i.imgur.com'],
  },
  // Explicitly set all API routes to use Edge runtime
  serverRuntimeConfig: {
    api: {
      bodyParser: false, // Don't parse body for Edge functions
    }
  }
}

module.exports = nextConfig 