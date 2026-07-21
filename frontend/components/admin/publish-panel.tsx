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

/** Wrap a 4:5 card into the 9:16 story frame so a story posts native, not
 *  letterboxed. Feed posts use the card as-is. */
function toStoryUrl(u: string): string {
  try {
    const url = new URL(u)
    if (url.pathname === '/api/og/story') return u
    return `${url.origin}/api/og/story?src=${encodeURIComponent(u)}`
  } catch { return u }
}

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
        <>
          <PublishButton state={story.state} setState={story.setState} label="Publică story"
                         onConfirm={() => story.publish([toStoryUrl(storyImage)], '', true)} />
          {/* IG's Stories API rejects our PNG (feed is fine) — reliable fallback:
              open the 9:16 image, save it, upload as a story from the app */}
          <a href={toStoryUrl(storyImage)} target="_blank" rel="noopener noreferrer"
             className="text-[11px] text-muted underline underline-offset-2">
            ⬇ descarcă story (pt. app)
          </a>
        </>
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

const segBtn = (active: boolean) =>
  `text-[12px] px-2.5 py-1 rounded-md border transition-colors ${
    active ? 'bg-foreground text-page border-foreground' : 'border-rim text-muted hover:bg-raised'}`

/** Absence / matrix card with a period toggle: whole mandate vs a chosen month. */
export function PeriodCard({ site, kind, months, bust }: {
  site: string
  kind: 'absente' | 'matrice'
  /** recent months, newest first: { value: '2026-06', label: 'iunie 2026' } */
  months: { value: string; label: string }[]
  /** daily stamp appended to bust the edge cache once a day (fresh data) */
  bust?: string
}) {
  const [mode, setMode] = useState<'all' | 'month'>(kind === 'absente' ? 'month' : 'all')
  const [month, setMonth] = useState(months[0]?.value ?? '')
  const [showPreview, setShowPreview] = useState(false)
  const label = mode === 'all' ? 'tot mandatul' : (months.find(m => m.value === month)?.label ?? month)

  const q = kind === 'absente'
    ? (mode === 'all' ? '' : `?month=${month}`)
    : (mode === 'all' ? '' : `?from=${month}&to=${month}`)
  const path = kind === 'absente' ? 'shamecard' : 'matrix'
  const image = `${site}/api/og/${path}${q}${bust ? `${q ? '&' : '?'}r=${bust}` : ''}`

  const HT = '#parlament #transparență #românia #laButoane'
  const defaultCaption = kind === 'absente'
    ? [`🔴 Absențe — ${mode === 'all' ? 'clasament (tot mandatul)' : label}: cei mai absenți parlamentari`, '',
       mode === 'all' ? 'Absențe la voturile din plen, de la validarea mandatului (dec. 2024).' : `Absențe la voturile din plen în ${label}.`, '',
       'Doar parlamentari activi; fără membrii Guvernului și fără cei cu notă de context.', '',
       `Toată lista: ${site}`, '', `#absenteism ${HT}`].join('\n')
    : [`🤝 Cine votează cu cine — ${label}`, '',
       'Procentul de voturi disputate în care partidele au votat la fel, două câte două. Voturile aproape unanime sunt excluse.', '',
       `Matricea interactivă: ${site}/analize`, '', `#politică ${HT}`].join('\n')

  const [caption, setCaption] = useState(defaultCaption)
  // reset caption + preview when the period changes (new content)
  useEffect(() => { setCaption(defaultCaption); setShowPreview(false) }, [mode, month]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={() => setMode('all')} className={segBtn(mode === 'all')}>Tot mandatul</button>
        <button onClick={() => setMode('month')} className={segBtn(mode === 'month')}>Pe lună</button>
        {mode === 'month' && (
          <select value={month} onChange={e => setMonth(e.target.value)}
                  className="text-[12px] bg-surface border border-rim rounded-md px-2 py-1">
            {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        )}
      </div>
      {showPreview
        ? <CardPreview src={image} alt="card" />
        : <button onClick={() => setShowPreview(true)} className="self-start text-[12px] text-muted underline underline-offset-2">👁 Vezi cardul</button>}
      <textarea value={caption} onChange={e => setCaption(e.target.value)} rows={8}
                className="w-full text-[12.5px] leading-relaxed bg-surface border border-rim rounded-lg p-2.5 font-mono resize-y" />
      <PublishActions images={[image]} caption={caption} storyImage={image} />
    </div>
  )
}

/** Pick this week's promulgated laws → post them as one carousel (a slide per
 *  law's summary card). Button + checkboxes. */
export function WeekSelectionCard({ site, laws }: {
  site: string
  /** desc = plain-language summary shown for picking; title = caption line */
  laws: { id: string; code: string; title: string; desc?: string }[]
}) {
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [showPreview, setShowPreview] = useState(false)
  const [edited, setEdited] = useState<string | null>(null)
  const chosen = laws.filter(l => sel.has(l.id))
  // slide 1 = the "look what passed this week" cover, then a card per law
  const images = chosen.length
    ? [`${site}/api/og/weekcover?n=${Math.min(chosen.length, 10)}`,
       ...chosen.slice(0, 9).map(l => `${site}/api/og/summarycard?id=${l.id}`)]
    : []
  const autoCaption = [
    '📋 Legile promulgate săptămâna aceasta', '',
    // full plain-language summary per law (blank line between for readability)
    ...chosen.flatMap(l => [`${l.code} — ${l.desc || l.title}`, '']).slice(0, -1),
    '', `Fiecare, explicată pe ${site} (link în bio)`, '',
    '#parlament #legi #laButoane #transparență #românia',
  ].join('\n')
  const caption = edited ?? autoCaption

  const toggle = (id: string) =>
    setSel(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); setEdited(null); return n })

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        {laws.length === 0 && <p className="text-[12px] text-faint">Nicio lege promulgată în ultimele 7 zile.</p>}
        {laws.map(l => {
          const desc = l.desc || l.title
          return (
            <label key={l.id} className="flex items-start gap-2 text-[12.5px] cursor-pointer py-1">
              <input type="checkbox" checked={sel.has(l.id)} onChange={() => toggle(l.id)} className="mt-1 flex-shrink-0" />
              <span className="min-w-0">
                <span className="font-mono font-semibold text-[11px] text-faint">{l.code}</span>
                <span className="block text-foreground leading-snug">{desc}</span>
              </span>
            </label>
          )
        })}
      </div>
      {chosen.length > 0 && (
        <>
          {showPreview
            ? <div className="flex gap-2.5 overflow-x-auto pb-1">{images.map((u, i) => <div key={u} className="w-[130px] flex-shrink-0"><CardPreview src={u} alt={`slide ${i + 1}`} stagger={i * 500} /></div>)}</div>
            : <button onClick={() => setShowPreview(true)} className="self-start text-[12px] text-muted underline underline-offset-2">👁 Vezi cardurile ({images.length})</button>}
          <textarea value={caption} onChange={e => setEdited(e.target.value)} rows={7}
                    className="w-full text-[12.5px] leading-relaxed bg-surface border border-rim rounded-lg p-2.5 font-mono resize-y" />
          <div className="flex items-center gap-3 flex-wrap">
            <PublishActions images={images} caption={caption} storyImage={images.length === 1 ? images[0] : undefined} />
            <span className="text-[11px] text-adoptat">{images.length} slide-uri{images.length > 10 ? ' (max 10)' : ''}</span>
          </div>
        </>
      )}
    </div>
  )
}
