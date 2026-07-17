import type { Metadata } from 'next'
import { IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google'
import './globals.css'
import { Analytics } from '@vercel/analytics/react'
import { Nav } from '@/components/nav'
import { Footer } from '@/components/footer'

// Brand type: IBM Plex Sans for display + UI (latin-ext for ă â î ș ț).
// `font-serif` classes stay in markup but render Plex Sans 600 (globals.css).
const plexSans = IBM_Plex_Sans({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
})

// Data, labels, codes — IBM Plex Mono.
const plexMono = IBM_Plex_Mono({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
})

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://la-butoane.ro'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  // per-page canonical on the real domain — the votro-beta.vercel.app mirror
  // serves identical content and would otherwise split indexing
  alternates: { canonical: './' },
  title: {
    default: 'LaButoane — Cum votează parlamentarii români',
    template: '%s | LaButoane',
  },
  description:
    'Urmărește voturile senatorilor și deputaților români. Transparență parlamentară în timp real.',
  openGraph: {
    siteName: 'LaButoane',
    locale: 'ro_RO',
    type: 'website',
    images: [{ url: '/api/og', width: 1200, height: 630, alt: 'LaButoane' }],
  },
  twitter: {
    card: 'summary_large_image',
    images: ['/api/og'],
  },
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/glyph.svg', type: 'image/svg+xml' },
      { url: '/icons/icon-192.png', type: 'image/png' },
    ],
    apple: '/icons/icon-192.png',
  },
}

// Sitelinks search box + site identity for Google
const SITE_LD = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'LaButoane',
  url: SITE_URL,
  description: 'Cum votează Parlamentul României — voturi, absențe, devieri de la linia de partid.',
  inLanguage: 'ro',
  potentialAction: {
    '@type': 'SearchAction',
    target: { '@type': 'EntryPoint', urlTemplate: `${SITE_URL}/cautare?q={search_term_string}` },
    'query-input': 'required name=search_term_string',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ro" className={`${plexSans.variable} ${plexMono.variable}`} suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://zmxewrkykbxawfhzxbni.supabase.co" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(SITE_LD) }} />
      </head>
      <body className="flex flex-col min-h-screen">
        <Nav />
        <main className="flex-1 max-w-[1280px] w-full mx-auto px-4 sm:px-8 lg:px-14 pt-6 sm:pt-8 pb-16">{children}</main>
        <Footer />
        <Analytics />
      </body>
    </html>
  )
}
