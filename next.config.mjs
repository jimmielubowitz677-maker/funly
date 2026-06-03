/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Set the client-side Router Cache TTL for dynamic routes to 0.
    // Without this, Next.js 14 caches RSC payloads in memory even when a page
    // uses `dynamic = 'force-dynamic'`.  Navigating away and back serves the
    // stale payload — e.g. profile images disappearing after visiting the feed.
    // Setting dynamic:0 makes every soft navigation to a dynamic route go back
    // to the server so data is always fresh.
    staleTimes: {
      dynamic: 0,
    },
  },
}

export default nextConfig
