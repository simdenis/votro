'use client'

// Admin-only publish widgets (/admin). Two-step publish button (arm → confirm)
// instead of window.confirm, and a preview <img> with a manual reload since the
// og routes 503 intermittently on the Free CPU cap.

import { useEffect, useRef, useState } from 'react'

type PubState =
  | { phase: 'idle' }
  | { phase: 'armed' }
  | { phase: 'busy' }
  | { phase: 'done'; mediaId: string; permalink: string | null }
  | { phase: 'error'; message: string }

function usePublish(adminKey: string) {
  const [state, setState] = useState<PubState>({ phase: 'idle' })
  async function publish(images: string[], caption: string) {
    setState({ phase: 'busy' })
    try {
      const r = await fetch('/api/admin/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Key': adminKey },
        body: JSON.stringify({ images, caption }),
      })
      const body = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(body.error || `HTTP ${r.status}`)
      setState({ phase: 'done', mediaId: body.mediaId, permalink: body.permalink })
    } catch (e) {
      setState({ phase: 'error', message: String(e instanceof Error ? e.message : e) })
    }
  }
  return { state, setState, publish }
}

function PublishButton({ state, setState, onConfirm }: {
  state: PubState
  setState: (s: PubState) => void
  onConfirm: () => void
}) {
  if (state.phase === 'done') {
    return (
      <span className="text-[13px] text-adoptat font-medium">
        ✓ Publicat{state.permalink && (
          <> — <a href={state.permalink} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">vezi postarea</a></>
        )}
      </span>
    )
  }
  return (
    <span className="flex items-center gap-2 flex-wrap">
      <button
        onClick={() => {
          if (state.phase === 'armed') onConfirm()
          else setState({ phase: 'armed' })
        }}
        disabled={state.phase === 'busy'}
        className={`text-[13px] font-medium px-3 py-1.5 rounded-md border transition-colors disabled:opacity-50 ${
          state.phase === 'armed'
            ? 'bg-respins text-white border-respins'
            : 'border-rim text-foreground hover:bg-raised'
        }`}
      >
        {state.phase === 'busy' ? 'Se publică…'
          : state.phase === 'armed' ? 'Sigur? Publică pe Instagram'
          : 'Publică'}
      </button>
      {state.phase === 'armed' && (
        <button onClick={() => setState({ phase: 'idle' })} className="text-[12px] text-faint underline underline-offset-2">
          anulează
        </button>
      )}
      {state.phase === 'error' && (
        <span className="text-[12px] text-respins">
          {state.message.includes('503') || state.message.toLowerCase().includes('container')
            ? 'Eroare (probabil randare 503 — reîncearcă): ' : 'Eroare: '}
          {state.message.slice(0, 200)}
        </span>
      )}
    </span>
  )
}

const MAX_AUTO_RETRIES = 4

function CardPreview({ src, alt, stagger = 0 }: { src: string; alt: string; stagger?: number }) {
  // The og render dies on the CPU cap ~1 in 3 tries until the edge cache has a
  // copy — so stagger the initial loads (9 at once guarantees casualties) and
  // auto-retry by remounting the <img> (same URL: error responses aren't
  // browser-cached, and a retry can hit the cache another attempt just filled).
  const [attempt, setAttempt] = useState(0)
  const [phase, setPhase] = useState<'waiting' | 'loading' | 'ok' | 'failed'>(stagger ? 'waiting' : 'loading')
  const [bust, setBust] = useState(0)

  useEffect(() => {
    if (phase !== 'waiting') return
    const t = setTimeout(() => setPhase('loading'), stagger)
    return () => clearTimeout(t)
  }, [phase, stagger])

  useEffect(() => {
    if (phase !== 'failed' || attempt >= MAX_AUTO_RETRIES) return
    const t = setTimeout(() => { setAttempt(a => a + 1); setPhase('loading') }, 1200 + attempt * 800)
    return () => clearTimeout(t)
  }, [phase, attempt])

  const url = bust ? `${src}${src.includes('?') ? '&' : '?'}r=${bust}` : src
  const givenUp = phase === 'failed' && attempt >= MAX_AUTO_RETRIES
  return (
    <div className="w-full sm:w-[220px] flex-shrink-0">
      {phase === 'loading' || phase === 'ok' ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={`${attempt}-${bust}`} src={url} alt={alt} loading="lazy"
             className="w-full rounded-lg border border-rim"
             onLoad={() => setPhase('ok')}
             onError={() => setPhase('failed')} />
      ) : (
        <div className="aspect-[4/5] flex items-center justify-center bg-surface border border-rim rounded-lg text-[12px] text-faint px-3 text-center">
          {givenUp ? 'randarea a eșuat de mai multe ori' : 'se randează…'}
        </div>
      )}
      {(givenUp || phase === 'ok') && (
        <button
          onClick={() => { setAttempt(0); setBust(b => b + 1); setPhase('loading') }}
          className="mt-1 text-[11px] text-faint underline underline-offset-2"
        >
          reîncarcă previzualizarea
        </button>
      )}
    </div>
  )
}

/** One candidate: preview + editable caption + publish (+ optional CLI command). */
export function PublishCard({ adminKey, image, initialCaption, command, stagger }: {
  adminKey: string
  image: string
  initialCaption: string
  command?: string
  /** ms to wait before first preview load — page-level load staggering. */
  stagger?: number
}) {
  const { state, setState, publish } = usePublish(adminKey)
  const [caption, setCaption] = useState(initialCaption)
  const [copied, setCopied] = useState(false)
  return (
    <div className="flex flex-col sm:flex-row gap-4">
      <CardPreview src={image} alt="Previzualizare card" stagger={stagger} />
      <div className="flex-1 min-w-0 flex flex-col gap-2">
        <textarea
          value={caption}
          onChange={e => setCaption(e.target.value)}
          rows={9}
          className="w-full text-[12.5px] leading-relaxed bg-surface border border-rim rounded-lg p-2.5 font-mono resize-y"
        />
        <div className="flex items-center gap-3 flex-wrap">
          <PublishButton state={state} setState={setState} onConfirm={() => publish([image], caption)} />
          {command && (
            <button
              onClick={() => { navigator.clipboard.writeText(command); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
              className="text-[12px] text-muted underline underline-offset-2"
              title={command}
            >
              {copied ? 'copiat ✓' : 'copiază comanda pt. caruselul complet'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

type DeckSlide = { url: string; label: string }

/** Static slide thumb: loads instantly or 404s (no CPU cap on assets) —
 *  a 404 means "not rendered yet", no retry needed. */
function SlideThumb({ slide, onStatus }: { slide: DeckSlide; onStatus: (ok: boolean) => void }) {
  const [failed, setFailed] = useState(false)
  return (
    <div className="w-[130px] flex-shrink-0">
      {failed ? (
        <div className="aspect-[4/5] flex flex-col items-center justify-center gap-1 bg-surface border border-dashed border-rim rounded-lg text-[10px] text-faint px-2 text-center">
          <span>nerandat</span>
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={slide.url} alt={slide.label} loading="lazy" className="w-full rounded-lg border border-rim"
             onLoad={() => onStatus(true)}
             onError={() => { setFailed(true); onStatus(false) }} />
      )}
      <div className="text-[10px] text-faint text-center mt-0.5">{slide.label}</div>
    </div>
  )
}

/** Law candidate: the full carousel deck (pre-rendered static slides) with
 *  per-slide status. Complete deck → one-tap carousel publish; incomplete →
 *  fall back to publishing just the (dynamic, edge-cached) summary card. */
export function CarouselPublishCard({ adminKey, slides, fallbackImage, initialCaption, command }: {
  adminKey: string
  slides: DeckSlide[]
  /** Dynamic summarycard URL — publishable even when the deck isn't rendered. */
  fallbackImage: string
  initialCaption: string
  command: string
}) {
  const { state, setState, publish } = usePublish(adminKey)
  const [caption, setCaption] = useState(initialCaption)
  const [copied, setCopied] = useState(false)
  const [status, setStatus] = useState<Record<string, boolean>>({})
  const ready = slides.filter(s => status[s.url] === true).length
  const settled = Object.keys(status).length === slides.length
  const complete = settled && ready === slides.length
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2.5 overflow-x-auto pb-1">
        {slides.map(s => (
          <SlideThumb key={s.url} slide={s}
                      onStatus={ok => setStatus(prev => ({ ...prev, [s.url]: ok }))} />
        ))}
      </div>
      <textarea
        value={caption}
        onChange={e => setCaption(e.target.value)}
        rows={9}
        className="w-full text-[12.5px] leading-relaxed bg-surface border border-rim rounded-lg p-2.5 font-mono resize-y"
      />
      <div className="flex items-center gap-3 flex-wrap">
        {complete ? (
          <PublishButton state={state} setState={setState}
                         onConfirm={() => publish(slides.map(s => s.url), caption)} />
        ) : (
          <>
            <PublishButton state={state} setState={setState}
                           onConfirm={() => publish([fallbackImage], caption)} />
            <span className="text-[11px] text-faint">
              {settled
                ? `doar rezumatul — ${slides.length - ready} slide-uri nerandate; pentru carusel rulează comanda ↓`
                : 'se verifică slide-urile…'}
            </span>
          </>
        )}
        <button
          onClick={() => { navigator.clipboard.writeText(command); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
          className="text-[12px] text-muted underline underline-offset-2"
          title={command}
        >
          {copied ? 'copiat ✓' : 'copiază comanda de randare'}
        </button>
        {complete && (
          <span className="text-[11px] text-adoptat">carusel complet — {slides.length} slide-uri ✓</span>
        )}
      </div>
    </div>
  )
}

/** Free-form: image URLs (one per line, 2+ = carousel) + caption. Prefillable
 *  from the monthly approval email (?img=&cap= b64url). */
export function ManualPublish({ adminKey, initialImages = '', initialCaption = '' }: {
  adminKey: string
  initialImages?: string
  initialCaption?: string
}) {
  const { state, setState, publish } = usePublish(adminKey)
  const [images, setImages] = useState(initialImages)
  const [caption, setCaption] = useState(initialCaption)
  const urls = images.split('\n').map(s => s.trim()).filter(Boolean)
  const previewRef = useRef<HTMLDivElement>(null)
  return (
    <div className="flex flex-col gap-2">
      {urls.length > 0 && (
        <div ref={previewRef} className="flex gap-3 overflow-x-auto">
          {urls.map((u, i) => <div key={i} className="w-[180px] flex-shrink-0"><CardPreview src={u} alt={`slide ${i + 1}`} stagger={i * 700} /></div>)}
        </div>
      )}
      <textarea
        value={images}
        onChange={e => setImages(e.target.value)}
        rows={3}
        placeholder={'URL imagine (unul pe linie; 2+ linii = carusel)'}
        className="w-full text-[12px] bg-surface border border-rim rounded-lg p-2.5 font-mono resize-y"
      />
      <textarea
        value={caption}
        onChange={e => setCaption(e.target.value)}
        rows={8}
        placeholder="Caption…"
        className="w-full text-[12.5px] leading-relaxed bg-surface border border-rim rounded-lg p-2.5 font-mono resize-y"
      />
      <div>
        <PublishButton state={state} setState={setState} onConfirm={() => publish(urls, caption)} />
      </div>
    </div>
  )
}
