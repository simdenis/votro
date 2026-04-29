import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        page:       'var(--bg)',
        surface:    'var(--surface)',
        raised:     'var(--raised)',
        rim:        'var(--rim)',
        foreground: 'var(--text)',
        muted:      'var(--muted)',
        faint:      'var(--faint)',
        adoptat:    '#22c55e',
        respins:    '#ef4444',
        deviere:    '#f59e0b',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
