/**
 * Records a device's Spelling Bee progress and returns how many devices played that puzzle and how many
 * reached Genius. A POST with words 0 only reads the counts.
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase'

const bodySchema = z
  .object({
    device: z.string().regex(/^[\w-]{8,64}$/),
    puzzle: z.string().regex(/^(\d{4}-\d{2}-\d{2}|p):[a-z]{7}$/),
    words: z.number().int().min(0).max(200),
    score: z.number().int().min(0).max(1000),
    max: z.number().int().min(1).max(1000),
  })
  .refine((b) => b.score <= b.max)

/**
 * Upserts the device's best score for the puzzle and returns { players, genius }.
 */
export async function POST(req: Request) {
  const body = bodySchema.safeParse(await req.json().catch(() => null))
  if (!body.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  const { device, puzzle, words, score, max } = body.data
  const { data, error } = await supabaseAdmin.rpc('spelling_bee_record', {
    p_device: device,
    p_puzzle: puzzle,
    p_words: words,
    p_score: score,
    p_max: max,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
