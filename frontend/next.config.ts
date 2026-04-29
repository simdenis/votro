import withPWA from '@ducanh2912/next-pwa'
import type { NextConfig } from 'next'

const baseConfig: NextConfig = {}

export default withPWA({
  dest: 'public',
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  fallbacks: { document: '/offline' },
  workboxOptions: { disableDevLogs: true },
})(baseConfig)
