'use client'

// Admin-only publish widgets (/admin). Two-step publish button (arm → confirm)
// instead of window.confirm, and a preview <img> with a manual reload since the
// og routes 503 intermittently on the Free CPU cap.

import { useEffect, useState } from 'react'

type PubState =
  | { phase: 'idle' }
  | { phase: 'armed' }
  | { phase: 'busy' }
  | { phase: 'done'; mediaId: string; permalink: string | null }
  | { phase: 'error'; message: string }

function usePublish() {
  const [state, setState] = useState<PubState>({ phase: 'idle' })
  async function publish(images: string[], caption: string, story = false) {
    setState({ phase: 'busy' })
    try {
      // auth via the httpOnly admin cookie (same-origin) — no key in JS
      const r = await fetch('/api/admin/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images, caption, story }),
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

function PublishButton({ state, setState, onConfirm, label = 'Publică' }: {
  state: PubState
  setState: (s: PubState) => void
  onConfirm: () => void
  label?: string
}) {
  if (state.phase === 'done') {
    return (
      <span className="flex flex-col gap-0.5 text-[13px]">
        <span className="text-adoptat font-medium">
          ✓ Publicat{state.permalink && (
            <> — <a href={state.permalink} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">vezi postarea</a></>
          )}
        </span>
        {/* IG's API can't delete — deep-link to the post so you can remove it
            manually in the app (⋯ → Șterge). */}
        {state.permalink && (
          <a href={state.permalink} target="_blank" rel="noopener noreferrer"
             className="text-[11px] text-respins underline underline-offset-2">
            greșit? șterge-l în aplicația Instagram →
          </a>
        )}
        <button onClick={() => setState({ phase: 'idle' })} className="text-[11px] text-faint underline underline-offset-2 self-start">
          publică din nou
        </button>
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
          : state.phase === 'armed' ? `Sigur? ${label} pe Instagram`
          : label}
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

/** The post/story button pair — independent state machines so publishing one
 *  doesn't hide the other (a good card can be both a feed post and a story). */
function PublishActions({ images, caption, storyImage }: {
  images: string[]
  caption: string
  /** Single image to push as a story; omit to hide the story button. */
  storyImage?: string
}) {
  const post = usePublish()
  const story = usePublish()
  return (
    <>
      <PublishButton state={post.state} setState={post.setState}
                     label={images.length > 1 ? `Publică post (${images.length} slide-uri)` : 'Publică post'}
                     onConfirm={() => post.publish(images, caption)} />
      {storyImage && (
        <PublishButton state={story.state} setState={story.setState} label="Publică story"
                       onConfirm={() => story.publish([storyImage], '', true)} />
      )}
    </>
  )
}

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

/** One card: preview (on demand) + editable caption + publish. */
export function PublishCard({ image, initialCaption, command }: {
  image: string
  initialCaption: string
  command?: string
}) {
  const [caption, setCaption] = useState(initialCaption)
  const [copied, setCopied] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  return (
    <div className="flex flex-col sm:flex-row gap-4">
      {showPreview ? (
        <CardPreview src={image} alt="Previzualizare card" />
      ) : (
        <button onClick={() => setShowPreview(true)}
                className="self-start sm:self-auto text-[12px] text-muted underline underline-offset-2 whitespace-nowrap">
          👁 Vezi cardul
        </button>
      )}
      <div className="flex-1 min-w-0 flex flex-col gap-2">
        <textarea
          value={caption}
          onChange={e => setCaption(e.target.value)}
          rows={9}
          className="w-full text-[12.5px] leading-relaxed bg-surface border border-rim rounded-lg p-2.5 font-mono resize-y"
        />
        <p className="text-[11px] text-faint">Caption-ul e doar pentru post — story-ul merge fără text și dispare în 24h.</p>
        <div className="flex items-center gap-3 flex-wrap">
          <PublishActions images={[image]} caption={caption} storyImage={image} />
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

/** Law candidate: the full carousel deck. On Workers Paid the slides render
 *  live (dynamic /api/og URLs) and are always publishable. Previews are
 *  hidden by default and load on demand — rendering all decks' slides at once
 *  is a thundering herd (~60 cold renders on page load); you only need to see
 *  a deck when you're about to post it. */
export function CarouselPublishCard({ slides, initialCaption }: {
  slides: DeckSlide[]
  initialCaption: string
}) {
  const [caption, setCaption] = useState(initialCaption)
  const [showPreview, setShowPreview] = useState(false)
  return (
    <div className="flex flex-col gap-3">
      {showPreview ? (
        <div className="flex gap-2.5 overflow-x-auto pb-1">
          {slides.map((s, i) => (
            <div key={s.url} className="w-[130px] flex-shrink-0">
              <CardPreview src={s.url} alt={s.label} stagger={i * 500} />
              <div className="text-[10px] text-faint text-center mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      ) : (
        <button onClick={() => setShowPreview(true)}
                className="self-start text-[12px] text-muted underline underline-offset-2">
          👁 Vezi cardurile ({slides.length})
        </button>
      )}
      <textarea
        value={caption}
        onChange={e => setCaption(e.target.value)}
        rows={9}
        className="w-full text-[12.5px] leading-relaxed bg-surface border border-rim rounded-lg p-2.5 font-mono resize-y"
      />
      <div className="flex items-center gap-3 flex-wrap">
        <PublishActions images={slides.map(s => s.url)} caption={caption} storyImage={slides[0]?.url} />
        <span className="text-[11px] text-adoptat">carusel · {slides.length} slide-uri</span>
      </div>
    </div>
  )
}

/** Free-form: image URLs (one per line, 2+ = carousel) + caption. Prefillable
 *  from the monthly approval email (?img=&cap= b64url). */
/** Accept a pasted PAGE link and turn it into a card image URL, so you can
 *  drop a /legi/<id> (or /voturi, /deputati, /senatori) link straight in.
 *  A real /api/og/… URL passes through unchanged. */
function toCardUrl(u: string): string {
  try {
    const url = new URL(u)
    if (url.pathname.startsWith('/api/og/')) return u
    const legi = url.pathname.match(/\/legi\/([0-9a-f-]{36})/)
    if (legi) return `${url.origin}/api/og/summarycard?id=${legi[1]}`
    const vot = url.pathname.match(/\/voturi\/([0-9a-f-]{36})/)
    if (vot) return `${url.origin}/api/og/votecard?vote=${vot[1]}`
    return u
  } catch { return u }
}

/** A single /legi/<id> link → the law's uuid, else null. */
function lawIdFromInput(images: string): string | null {
  const lines = images.split('\n').map(s => s.trim()).filter(Boolean)
  if (lines.length !== 1) return null
  const m = lines[0].match(/\/legi\/([0-9a-f-]{36})/)
  return m ? m[1] : null
}

export function ManualPublish({ initialImages = '', initialCaption = '' }: {
  initialImages?: string
  initialCaption?: string
}) {
  const [images, setImages] = useState(initialImages)
  const [caption, setCaption] = useState(initialCaption)
  const [showPreview, setShowPreview] = useState(false)
  const [expanding, setExpanding] = useState(false)
  const urls = images.split('\n').map(s => s.trim()).filter(Boolean).map(toCardUrl)
  const converted = images.split('\n').map(s => s.trim()).filter(Boolean).some(u => toCardUrl(u) !== u)
  const expandableLawId = lawIdFromInput(images)

  async function expandToDeck() {
    if (!expandableLawId) return
    setExpanding(true)
    try {
      const r = await fetch(`/api/admin/deck?id=${expandableLawId}`)
      const body = await r.json()
      if (r.ok && body.slides?.length) {
        setImages(body.slides.map((s: { url: string }) => s.url).join('\n'))
        if (body.caption) setCaption(body.caption)
        setShowPreview(false)
      }
    } finally { setExpanding(false) }
  }

  return (
    <div className="flex flex-col gap-2">
      {expandableLawId && (
        <button onClick={expandToDeck} disabled={expanding}
                className="self-start text-[12px] font-medium text-info underline underline-offset-2 disabled:opacity-50">
          {expanding ? 'se încarcă…' : '🎠 Extinde în carusel complet (hook + rezumat + camere + devieri)'}
        </button>
      )}
      {urls.length > 0 && (
        showPreview ? (
          <div className="flex gap-3 overflow-x-auto">
            {urls.map((u, i) => <div key={i} className="w-[180px] flex-shrink-0"><CardPreview src={u} alt={`slide ${i + 1}`} stagger={i * 500} /></div>)}
          </div>
        ) : (
          <button onClick={() => setShowPreview(true)} className="self-start text-[12px] text-muted underline underline-offset-2">
            👁 Vezi {urls.length > 1 ? `cardurile (${urls.length})` : 'cardul'}
          </button>
        )
      )}
      {converted && <p className="text-[11px] text-adoptat">✓ link de pagină → card automat</p>}
      <textarea
        value={images}
        onChange={e => setImages(e.target.value)}
        rows={3}
        placeholder={'Lipește un link de lege (/legi/…) sau un URL de card — unul pe linie; 2+ = carusel'}
        className="w-full text-[12px] bg-surface border border-rim rounded-lg p-2.5 font-mono resize-y"
      />
      <textarea
        value={caption}
        onChange={e => setCaption(e.target.value)}
        rows={8}
        placeholder="Caption…"
        className="w-full text-[12.5px] leading-relaxed bg-surface border border-rim rounded-lg p-2.5 font-mono resize-y"
      />
      <div className="flex items-center gap-3 flex-wrap">
        <PublishActions images={urls} caption={caption}
                        storyImage={urls.length === 1 ? urls[0] : undefined} />
        {urls.length > 1 && <span className="text-[11px] text-faint">story = doar cu o singură imagine</span>}
      </div>
    </div>
  )
}
