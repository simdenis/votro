'use client'

import { useEffect, useState } from 'react'
import { Sun, Moon } from 'lucide-react'

export function ThemeToggle({ withLabel = false }: { withLabel?: boolean }) {
  const [isLight, setIsLight] = useState(false)

  useEffect(() => {
    setIsLight(document.documentElement.classList.contains('light'))
  }, [])

  function toggle() {
    const next = !isLight
    setIsLight(next)
    if (next) {
      document.documentElement.classList.add('light')
      localStorage.setItem('theme', 'light')
    } else {
      document.documentElement.classList.remove('light')
      localStorage.setItem('theme', 'dark')
    }
  }

  const label = isLight ? 'Mod întunecat' : 'Mod luminos'

  return (
    <button
      onClick={toggle}
      className="flex items-center gap-2 text-muted hover:text-foreground transition-colors p-1 text-xs"
      title={label}
      aria-label={label}
    >
      {isLight ? <Moon size={15} /> : <Sun size={15} />}
      {withLabel && <span>{label}</span>}
    </button>
  )
}
