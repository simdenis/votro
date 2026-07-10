// LaButoane logo system (design_handoff_labutoane_brand/Logo.jsx.txt).
// Glyph = console panel: dark tile, four button lights (green/amber/coral/blue).
// Wordmark = La(400)Butoane(700) + mono .ro suffix. Colors ink-only, per brand.

export function Glyph({ size = 32, mono }: { size?: number; mono?: 'black' | 'white' }) {
  if (mono) {
    const c = mono === 'white' ? '#F5F6F8' : '#000'
    return (
      <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
        <rect x="2" y="4" width="60" height="56" rx="15" fill="none" stroke={c} strokeWidth="4" />
        <rect x="14" y="14" width="14" height="14" rx="5" fill={c} />
        <rect x="36" y="14" width="14" height="14" rx="5" fill="none" stroke={c} strokeWidth="3" />
        <rect x="14" y="36" width="14" height="14" rx="5" fill="none" stroke={c} strokeWidth="3" />
        <rect x="36" y="36" width="14" height="14" rx="5" fill={c} />
      </svg>
    )
  }
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="15" fill="var(--ink)" />
      <rect x="11" y="11" width="18" height="18" rx="6" fill="var(--color-for)" />
      <rect x="35" y="11" width="18" height="18" rx="6" fill="var(--color-abstention)" />
      <rect x="11" y="35" width="18" height="18" rx="6" fill="var(--color-against)" />
      <rect x="35" y="35" width="18" height="18" rx="6" fill="var(--info)" />
    </svg>
  )
}

export function Wordmark({
  fontSize = 21,
  color = 'var(--ink)',
  suffixColor = 'var(--faint)',
  // labutoane.ro isn't ours (yet) — no suffix until the domain is real
  suffix = false,
}: {
  fontSize?: number
  color?: string
  suffixColor?: string
  suffix?: boolean
}) {
  return (
    <span style={{ fontFamily: 'var(--font-sans)', fontSize, letterSpacing: '-0.015em', color, lineHeight: 1 }}>
      <span style={{ fontWeight: 400 }}>La</span>
      <span style={{ fontWeight: 700 }}>Butoane</span>
      {suffix && (
        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 500, fontSize: Math.round(fontSize * 0.62), color: suffixColor }}>
          .ro
        </span>
      )}
    </span>
  )
}

export function Logo({ size = 24, ...wordmarkProps }: { size?: number } & Parameters<typeof Wordmark>[0]) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: Math.round(size * 0.38) }}>
      <Glyph size={size} />
      <Wordmark fontSize={Math.round(size * 0.7)} {...wordmarkProps} />
    </span>
  )
}
