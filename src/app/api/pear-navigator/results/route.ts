import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('pear_navigator_ab_results')
      .select('id, variant, task_id, rating, total_sec, avg_sec_per_step, steps_count, created_at')
      .order('created_at', { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const rows = (data ?? []).map((r) => ({
      id: r.id,
      variant: r.variant,
      taskId: r.task_id,
      rating: r.rating,
      totalSec: r.total_sec,
      avgSecPerStep: r.avg_sec_per_step,
      stepsCount: r.steps_count,
      createdAt: r.created_at ?? new Date().toISOString(),
    }))
    const byVariant = { a: { count: 0, totalSec: 0, ratings: { meh: 0, good: 0, great: 0 } }, b: { count: 0, totalSec: 0, ratings: { meh: 0, good: 0, great: 0 } } }
    const byTask: Record<string, { count: number; totalSec: number; ratings: Record<string, number> }> = {}
    for (const r of rows) {
      const v = r.variant as 'a' | 'b'
      const rate = r.rating as 'meh' | 'good' | 'great'
      byVariant[v].count++
      byVariant[v].totalSec += r.totalSec
      byVariant[v].ratings[rate] = (byVariant[v].ratings[rate] ?? 0) + 1
      if (!byTask[r.taskId]) byTask[r.taskId] = { count: 0, totalSec: 0, ratings: { meh: 0, good: 0, great: 0 } }
      const t = byTask[r.taskId]!
      t.count++
      t.totalSec += r.totalSec
      t.ratings[rate] = (t.ratings[rate] ?? 0) + 1
    }
    const summary = {
      total: rows.length,
      byVariant: {
        a: { count: byVariant.a.count, avgSec: byVariant.a.count ? Math.round(byVariant.a.totalSec / byVariant.a.count) : 0, ratings: byVariant.a.ratings },
        b: { count: byVariant.b.count, avgSec: byVariant.b.count ? Math.round(byVariant.b.totalSec / byVariant.b.count) : 0, ratings: byVariant.b.ratings },
      },
      byTask: Object.fromEntries(
        Object.entries(byTask).map(([k, v]) => [k, { count: v.count, avgSec: v.count ? Math.round(v.totalSec / v.count) : 0, ratings: v.ratings }])
      ),
    }
    return NextResponse.json({ rows, summary })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { variant, taskId, rating, totalSec, avgSecPerStep, stepsCount } = body as {
      variant?: string
      taskId?: string
      rating?: string
      totalSec?: number
      avgSecPerStep?: number
      stepsCount?: number
    }
    if (!variant || !taskId || !rating || !Number.isFinite(totalSec) || !Number.isFinite(avgSecPerStep) || !Number.isFinite(stepsCount)) {
      return NextResponse.json({ error: 'variant, taskId, rating, totalSec, avgSecPerStep, stepsCount required' }, { status: 400 })
    }
    if (!['a', 'b'].includes(variant) || !['meh', 'good', 'great'].includes(rating)) {
      return NextResponse.json({ error: 'Invalid variant or rating' }, { status: 400 })
    }
    const { error } = await supabaseAdmin.from('pear_navigator_ab_results').insert({
      variant,
      task_id: taskId,
      rating,
      total_sec: Math.round(totalSec ?? 0),
      avg_sec_per_step: Math.round(avgSecPerStep ?? 0),
      steps_count: Math.round(stepsCount ?? 0),
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
