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
  },
  // Expose environment variables to the browser and server
  env: {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    ASTRADB_DB_NAMESPACE: process.env.ASTRADB_DB_NAMESPACE,
    ASTRA_DB_API_ENDPOINT: process.env.ASTRA_DB_API_ENDPOINT,
    ASTRA_DB_APPLICATION_TOKEN: process.env.ASTRA_DB_APPLICATION_TOKEN,
    ASTRADB_DB_COLLECTION: process.env.ASTRADB_DB_COLLECTION,
  }
}

module.exports = nextConfig 