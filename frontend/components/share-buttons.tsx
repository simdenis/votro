'use client'

interface ShareButtonsProps {
  url: string
  tweet: string
}

export function ShareButtons({ url, tweet }: ShareButtonsProps) {
  function copy() {
    navigator.clipboard.writeText(url).catch(() => {})
  }

  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweet)}`
  const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <button
        onClick={copy}
        className="text-xs text-muted border border-rim rounded px-3 py-1.5 hover:text-foreground hover:border-foreground transition-colors"
      >
        Copiază link
      </button>
      <a
        href={twitterUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-muted border border-rim rounded px-3 py-1.5 hover:text-foreground hover:border-foreground transition-colors"
      >
        Distribuie pe X
      </a>
      <a
        href={facebookUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-muted border border-rim rounded px-3 py-1.5 hover:text-foreground hover:border-foreground transition-colors"
      >
        Distribuie pe Facebook
      </a>
    </div>
  )
}
