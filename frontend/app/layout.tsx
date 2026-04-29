import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Nav } from '@/components/nav'
import { Footer } from '@/components/footer'

const inter = Inter({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-inter',
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
    <html lang="ro" className={inter.variable}>
      <head>
        <script dangerouslySetInnerHTML={{ __html:
          `try{if(localStorage.getItem('theme')!=='dark')document.documentElement.classList.add('light')}catch(e){}`
        }} />
        <link rel="preconnect" href="https://zmxewrkykbxawfhzxbni.supabase.co" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>
        <Nav />
        <main className="max-w-5xl mx-auto px-4 py-10">{children}</main>
        <Footer />
      </body>
    </html>
  )
}
