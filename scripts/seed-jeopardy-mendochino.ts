/**
 * Insert the mendochino Jeopardy board from data/jeopardy into Supabase as a shared lobby.
 * Idempotent: if a row already exists with title="mendochino", reuses that slug.
 *
 * Requires env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (in .env or .env.local).
 * Usage:   npm run seed:jeopardy-mendochino
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { v4 as uuidv4 } from 'uuid'
import { normalizeBoard } from '../src/lib/jeopardy-ops'
import { defaultPlayState } from '../src/lib/jeopardy-play-ops'
import { generateBoardSlug } from '../src/lib/jeopardy'

function loadEnvLocal(): void {
  for (const file of ['.env.local', '.env']) {
    const p = join(process.cwd(), file)
    if (!existsSync(p)) continue
    for (const line of readFileSync(p, 'utf8').split('\n')) {
      const t = line.trim()
      if (!t || t.startsWith('#')) continue
      const eq = t.indexOf('=')
      if (eq <= 0) continue
      const k = t.slice(0, eq).trim()
      let v = t.slice(eq + 1).trim()
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
      if (!(k in process.env)) process.env[k] = v
    }
  }
}
loadEnvLocal()

const FILE = 'mendochino.jeopardy.json'

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (set in .env.local).')
  }
  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })

  const full = join(process.cwd(), 'data', 'jeopardy', FILE)
  const raw = JSON.parse(readFileSync(full, 'utf-8')) as unknown
  const board = normalizeBoard(raw, FILE.replace(/\.jeopardy\.json$/, ''))
  const title = board.title || 'mendochino'

  // Reuse latest existing row with same title (so re-running doesn't spam new lobbies).
  const { data: existing } = await supabase
    .from('jeopardy_boards')
    .select('slug, title, updated_at')
    .eq('title', title)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existing?.slug) {
    console.log(`[seed] Reusing existing lobby for "${title}".`)
    console.log(`  slug:    ${existing.slug}`)
    console.log(`  play:    /games/jeopardy/play/${existing.slug}`)
    console.log(`  edit:    /games/jeopardy/edit/${existing.slug}`)
    return
  }

  const id = uuidv4()
  const now = new Date().toISOString()
  for (let attempt = 0; attempt < 6; attempt++) {
    const slug = generateBoardSlug(title)
    const { error } = await supabase.from('jeopardy_boards').insert({
      id,
      slug,
      title,
      board: { ...board, id, title },
      base_value: board.baseValue,
      increment: board.increment,
      version: 0,
      last_editor: 'seed:mendochino',
      play_state: defaultPlayState(),
      play_version: 0,
      created_at: now,
      updated_at: now,
    })
    if (!error) {
      console.log(`[seed] Created lobby for "${title}".`)
      console.log(`  slug:    ${slug}`)
      console.log(`  play:    /games/jeopardy/play/${slug}`)
      console.log(`  edit:    /games/jeopardy/edit/${slug}`)
      return
    }
    const code = error.code?.toString() || ''
    if (!code.includes('23505') && !error.message?.includes('duplicate')) {
      throw new Error(`Insert failed: ${error.message}`)
    }
  }
  throw new Error('Could not allocate unique slug after 6 attempts.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
