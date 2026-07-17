#!/usr/bin/env node
/**
 * Render the Instagram card slides for a law carousel OFFLINE and drop them in
 * public/ig/, so the poster can hand Instagram static file URLs instead of the
 * /api/og routes that 503 on the Cloudflare Free plan (the seat-arc hemicycle
 * cards blow the 10ms CPU cap per request; in plain Node there is no cap).
 *
 * Flow:
 *   1. ask the poster for the slide manifest  (python --emit-slides <law_id>)
 *   2. render each slide from a local Next server  (spawns `next dev` unless --base)
 *   3. write public/ig/<name>.png  (deterministic names shared with the poster)
 *   4. print the deploy + publish commands
 *
 * Usage:
 *   node scripts/render-ig.mjs <law_id> [--base http://localhost:3000] [--hook "..."]
 *
 * Then:  npm run deploy   (ships public/ig/*.png as static assets)
 * Then:  cd ../scraper && python instagram_poster.py --law <law_id> --static --dry-run
 */
import { spawn, execFileSync } from 'node:child_process'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { setTimeout as sleep } from 'node:timers/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FRONTEND = path.resolve(__dirname, '..')
const REPO = path.resolve(FRONTEND, '..')
const SCRAPER = path.join(REPO, 'scraper')
const OUT_DIR = path.join(FRONTEND, 'public', 'ig')
const PY = path.join(SCRAPER, '.venv', 'bin', 'python')
const POSTER = path.join(SCRAPER, 'instagram_poster.py')

// ── args ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const flag = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined }
const lawId = args.find((a) => !a.startsWith('--') && args[args.indexOf(a) - 1]?.startsWith('--') !== true)
  || args.find((a) => !a.startsWith('--'))
const baseArg = flag('--base')
const hook = flag('--hook')
if (!lawId) {
  console.error('usage: node scripts/render-ig.mjs <law_id> [--base http://localhost:3000] [--hook "..."]')
  process.exit(1)
}

// ── read frontend env (Supabase creds passed to the poster; SITE_URL for print)
async function readEnv() {
  const out = {}
  try {
    const txt = await readFile(path.join(FRONTEND, '.env.local'), 'utf8')
    for (const line of txt.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  } catch { /* fall through — poster falls back to scraper/.env */ }
  return out
}

const ping = (base) =>
  fetch(`${base}/api/v1`, { signal: AbortSignal.timeout(2000) }).then((r) => r.ok).catch(() => false)

async function ensureServer(base) {
  if (await ping(base)) { console.log(`• using running server at ${base}`); return null }
  console.log('• starting `next dev` (no --base given)…')
  const child = spawn('npm', ['run', 'dev'], { cwd: FRONTEND, stdio: 'ignore', detached: true })
  for (let i = 0; i < 60; i++) {
    await sleep(1500)
    if (await ping(base)) { console.log('• dev server ready'); return child }
  }
  try { process.kill(-child.pid) } catch {}
  throw new Error('dev server did not become ready in 90s')
}

async function main() {
  const env = await readEnv()
  const base = baseArg || 'http://localhost:3000'
  const siteUrl = (env.NEXT_PUBLIC_SITE_URL || 'https://la-butoane.ro').replace(/\/$/, '')

  // 1. slide manifest from the poster (single source of truth)
  const pyEnv = { ...process.env }
  if (env.NEXT_PUBLIC_SUPABASE_URL) pyEnv.SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
  if (env.NEXT_PUBLIC_SUPABASE_ANON_KEY) pyEnv.SUPABASE_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const emitArgs = [POSTER, '--emit-slides', lawId]
  if (hook) emitArgs.push('--hook', hook)
  let manifest
  try {
    manifest = JSON.parse(execFileSync(PY, emitArgs, { cwd: SCRAPER, env: pyEnv, encoding: 'utf8' }))
  } catch (e) {
    console.error('failed to get slide manifest from the poster:\n', e.stderr || e.message)
    process.exit(1)
  }
  const { slides } = manifest
  console.log(`• ${slides.length} slide(s) to render for law ${lawId}\n`)

  await mkdir(OUT_DIR, { recursive: true })

  // 2 + 3. render each slide from a local server, write to public/ig/
  let server
  try {
    server = await ensureServer(base)
    for (const { suffix, name } of slides) {
      const res = await fetch(`${base}/api/${suffix}`)
      const ct = res.headers.get('content-type') || ''
      if (!res.ok || !ct.includes('image/png')) {
        throw new Error(`render failed: ${suffix} → HTTP ${res.status} (${ct})`)
      }
      const buf = Buffer.from(await res.arrayBuffer())
      await writeFile(path.join(OUT_DIR, name), buf)
      console.log(`  ✓ ${name}  ${(buf.length / 1024) | 0} KB   ← ${suffix.split('?')[0]}`)
    }
  } finally {
    if (server) { try { process.kill(-server.pid) } catch {} }
  }

  // 4. next steps
  console.log(`\n✅ Rendered ${slides.length} slide(s) → public/ig/`)
  console.log('\nStatic URLs (live after deploy):')
  for (const { name } of slides) console.log(`  ${siteUrl}/${'ig'}/${name}`)
  console.log('\nNext:')
  console.log('  1) npm run deploy            # ships public/ig/*.png as static assets')
  console.log('  2) verify one is live:  curl -sI ' + `${siteUrl}/ig/${slides[0].name}` + ' | head -1')
  console.log(`  3) cd ../scraper && python instagram_poster.py --law ${lawId}${hook ? ` --hook ${JSON.stringify(hook)}` : ''} --static --dry-run`)
  console.log('  4) drop --dry-run to publish')
}

main().catch((e) => { console.error(e.message || e); process.exit(1) })
