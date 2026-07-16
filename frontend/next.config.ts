import withPWA from '@ducanh2912/next-pwa'
import type { NextConfig } from 'next'
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare'

// Makes Cloudflare bindings (R2 cache, env) available during `next dev`.
initOpenNextCloudflareForDev()

const baseConfig: NextConfig = {
  // English slugs lived at launch (shared links, IG posts, Google index) —
  // 308 them to the Romanian scheme.
  async redirects() {
    return [
      // the *.vercel.app mirror must not compete with the real domain in Google
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'votro-beta.vercel.app' }],
        destination: 'https://la-butoane.ro/:path*',
        permanent: true,
      },
      // /saptamana was removed — send its inbound links (newsletter, index) to /voturi
      { source: '/saptamana', destination: '/voturi', permanent: true },
      // :path* matches zero segments too, so these cover /votes and /votes/<id>
      { source: '/votes/:path*',    destination: '/voturi/:path*',   permanent: true },
      { source: '/senators/:path*', destination: '/senatori/:path*', permanent: true },
      { source: '/deputies/:path*', destination: '/deputati/:path*', permanent: true },
      { source: '/parties/:path*',  destination: '/partide/:path*',  permanent: true },
    ]
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
        ],
      },
    ]
  },
}

// The service worker must never cache-intercept navigations: the default
// runtime caching (NetworkFirst on documents + RSC, CacheFirst on JS) let a
// stale worker pin an old build and kill sort/filter navigation with 503s —
// clicks silently did nothing until the worker updated. PWA keeps only
// installability, the precached shell and the offline fallback; everything
// else is plain network + browser HTTP cache (static assets are content-
// hashed anyway).
export default withPWA({
  dest: 'public',
  reloadOnOnline: true,
  fallbacks: { document: '/offline' },
  workboxOptions: {
    disableDevLogs: true,
    runtimeCaching: [
      {
        urlPattern: ({ request, sameOrigin }: { request: Request; sameOrigin: boolean }) =>
          sameOrigin && request.mode === 'navigate',
        handler: 'NetworkOnly',
      },
    ],
  },
})(baseConfig)
