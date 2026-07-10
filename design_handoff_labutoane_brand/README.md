# Handoff: LaButoane.ro — Logo & Brand Identity

## Overview
Brand identity for LaButoane.ro, a Romanian civic-tech platform tracking parliamentary votes ("la butoane" = "at the controls"; MPs literally vote by pressing buttons). The identity: a **sober ink wordmark** + a **console-panel glyph** (dark tile with four colored button lights) + a **five-hue functional palette** where every color carries voting meaning — so the brand stays politically unaffiliated.

## About the Design Files
The files in this bundle are **design references created in HTML** — they show intended look and behavior, and are not production code to copy directly. Recreate them in the target codebase's environment (Next.js/React on the existing labutoane Vercel app, or whatever framework exists) using its established patterns. If no frontend exists yet, a React/Next.js implementation is recommended.

## Fidelity
**High-fidelity.** Colors, typography, spacing, and radii below are final values. Recreate pixel-perfectly.

## Brand Rules (non-negotiable)
- Wordmark text is always ink or pure black/white — never colored.
- Colors are **functional**, never decorative: green = Pentru, coral = Împotrivă, amber = Abținere / tacit adoption, blue = links/info, gray = Absent. Never use them for emphasis unrelated to these meanings.
- No Romanian tricolor, no party colors as dominant hues, no ballot/checkmark iconography.
- Romanian diacritics (ă â î ș ț) must render correctly — IBM Plex fully supports them; always load the `latin-ext` subset.

## Logo System

### 1. Wordmark
`La` (weight 400) + `Butoane` (weight 700) in IBM Plex Sans, letter-spacing -0.015em, color `--ink`; suffix `.ro` in IBM Plex Mono 500 at ~60% of the wordmark font size, color `--gray-500`, baseline-aligned.

### 2. Glyph ("console panel")
Dark rounded tile with a 2×2 grid of rounded button lights (green, amber / coral, blue — reading order TL, TR, BL, BR). Proportions at 64px: tile radius 15/64, padding 11/64, dot gap 6/64, dot radius 6/64. Works from 8px up. SVG provided in `assets/`.

### 3. Lockup
Glyph + wordmark, horizontally aligned to optical center, gap ≈ 0.38× glyph height.

### 4. One-color versions
- **Black:** tile becomes 2px black outline with `0 3px 0 #000` hard shadow; dots alternate solid (TL, BR) and 1.5px hollow (TR, BL). Wordmark pure `#000`.
- **Reversed white:** identical construction in `#F5F6F8` on ink/photo backgrounds.
SVGs for both in `assets/`.

### 5. Favicon / avatar
Use `assets/glyph.svg` as-is. At 16px the four dots still read; no simplification needed.

## Design Tokens

Colors:
- `--ink: #171A1F` — text, dark tile, headers
- `--paper: #F5F6F8` — cool white surface
- `--white: #FFFFFF` — page background
- `--slate-700: #3D4759` — secondary text, default link hover
- `--gray-500: #6E7480` — tertiary text, .ro suffix
- `--gray-400: #9AA0AA` — labels, metadata
- `--gray-300: #D8DBE0` — borders, ABSENT state
- `--gray-150: #E7E9EC` — hairline dividers
- `--vote-for: #2EA871` (dark: `#1F7A51`) — Pentru, active nav
- `--vote-against: #EE7B5E` (dark: `#C25539`) — Împotrivă
- `--vote-abstain: #E3A23C` (dark: `#B27A24`) — Abținere, legi tacite
- `--info: #4E86D8` (dark: `#33639F`) — links, informational
(The five hues sit at equal OKLCH lightness/chroma; if you need more shades, derive in oklch by shifting L only.)

Typography:
- Display/UI: `"IBM Plex Sans", system-ui, sans-serif` — weights 400, 500, 600, 700
- Data/labels: `"IBM Plex Mono", monospace` — weights 400, 500
- Google Fonts URL must include `subset=latin-ext` (Romanian diacritics)
- Scale used in mocks: 42px wordmark hero, 16px header wordmark, 15px body, 12.5px table cells, 9.5px/`.08em` uppercase mono column labels

Spacing & shape:
- Radii: glyph tile 13px (at 33px size — scale proportionally), UI cards 12px, small chips 3–7px
- Hard shadow (keycap depth): `box-shadow: 0 5px 0 <dark shade>` — no blur, ever
- Vote-state dot: 8px circle, filled with the state color

## Key UI Patterns (from mocks)
- **Header:** white bg, 1px `--gray-150` bottom border, glyph (13px content) + wordmark 16px, nav 12.5px with 2px `--vote-for` underline on active item, right-aligned `NEAFILIAT POLITIC` mono badge (9.5px, .1em tracking, 1px `--gray-300` border, 3px radius).
- **Data table:** `#FBFBFC` bg, uppercase mono column headers, 8px vote dots + label, 1px `#F0F1F3` row dividers.
- **Social/OG card:** white image area, centered glyph (26px content) above 15px lockup; title 13.5px/600; meta 12px `--gray-500`; domain in mono.

## Interactions & Behavior
- Links: default `--slate-700` → hover `--ink`; in running text `--info` is acceptable for external/info links.
- Active nav: 2px bottom border `--vote-for`.
- No animation is part of the identity; if used, keep ≤150ms ease-out.

## State Management
None — static brand assets. Vote-state colors should map from a single enum: `for | against | abstain | absent` → token.

## Assets
- `assets/glyph.svg` — primary color glyph / favicon / avatar
- `assets/glyph-mono-black.svg` — one-color black
- `assets/glyph-mono-white.svg` — reversed white
- `Logo.jsx.txt` — reference React component (wordmark + lockup, all sizes) — reference only, adapt to codebase
- `tokens.css` — CSS custom properties, copy-ready
- `LaButoane Brand.dc.html` — full design exploration file (turn 3, option 3a is the approved direction)

## Files
All in this folder. The approved identity is option **3a** in `LaButoane Brand.dc.html`.
