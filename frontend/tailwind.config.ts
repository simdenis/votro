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
        sidebar:    'var(--sidebar-bg)',
        // Semantic vote colors — one token per meaning
        adoptat:    'var(--color-for)',
        respins:    'var(--color-against)',
        abstention: 'var(--color-abstention)',
        deviere:    'var(--color-deviation)',
      },
      fontFamily: {
        sans:  ['var(--font-sans)',  'system-ui', 'sans-serif'],
        serif: ['var(--font-serif)', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
}

export default config
