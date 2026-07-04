import type { Metadata } from 'next'
import { DM_Serif_Display, DM_Sans } from 'next/font/google'
import './globals.css'
import { Nav } from '@/components/nav'
import { Footer } from '@/components/footer'

// Display serif for headlines. Used via `font-serif`.
const dmSerif = DM_Serif_Display({
  subsets: ['latin', 'latin-ext'],
  weight: ['400'],
  style: ['normal', 'italic'],
  variable: '--font-serif',
  display: 'swap',
})

// Body sans. Used via `font-sans` / default body font.
const dmSans = DM_Sans({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-sans',
  display: 'swap',
})

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://votro.ro'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'VotRO — Cum votează parlamentarii români',
    template: '%s | VotRO',
  },
  description:
    'Urmărește voturile senatorilor și deputaților români. Transparență parlamentară în timp real.',
  openGraph: {
    siteName: 'VotRO',
    locale: 'ro_RO',
    type: 'website',
    images: [{ url: '/api/og', width: 1200, height: 630, alt: 'VotRO' }],
  },
  twitter: {
    card: 'summary_large_image',
    images: ['/api/og'],
  },
  manifest: '/manifest.json',
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/icon-192.png',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ro" className={`${dmSerif.variable} ${dmSans.variable}`} suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://zmxewrkykbxawfhzxbni.supabase.co" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="flex min-h-screen">
        <Nav />
        <div className="flex flex-col flex-1 min-w-0">
          <main className="flex-1 max-w-[1040px] w-full px-4 sm:px-8 lg:px-14 pt-5 sm:pt-7 pb-16">{children}</main>
          <Footer />
        </div>
      </body>
    </html>
  )
}
