import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    const { data: sessions, error } = await supabaseAdmin
      .from('pear_navigator_sessions')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const { data: legacy } = await supabaseAdmin
      .from('pear_navigator_ab_results')
      .select('*')
      .order('created_at', { ascending: false })

    const rows = (sessions ?? []).map((r) => ({
      id: r.id,
      sessionId: r.session_id,
      variant: r.variant,
      taskId: r.task_id,
      stepReached: r.step_reached,
      stepTimes: (r.step_times as number[]) ?? [],
      completed: r.completed,
      rating: r.rating,
      totalSec: r.total_sec,
      stepsCount: r.steps_count,
      createdAt: r.created_at ?? new Date().toISOString(),
      updatedAt: r.updated_at ?? new Date().toISOString(),
    }))

    const legacyRows = (legacy ?? []).map((r) => ({
      id: r.id,
      sessionId: null,
      variant: r.variant,
      taskId: r.task_id,
      stepReached: r.steps_count - 1,
      stepTimes: [] as number[],
      completed: true,
      rating: r.rating,
      totalSec: r.total_sec,
      stepsCount: r.steps_count,
      createdAt: r.created_at ?? new Date().toISOString(),
      updatedAt: r.created_at ?? new Date().toISOString(),
    }))

    const all = [...rows, ...legacyRows]
    return NextResponse.json({ rows: all })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      sessionId,
      variant,
      taskId,
      stepReached,
      stepTimes,
      completed,
      rating,
      totalSec,
      stepsCount,
    } = body as {
      sessionId?: string
      variant?: string
      taskId?: string
      stepReached?: number
      stepTimes?: number[]
      completed?: boolean
      rating?: string
      totalSec?: number
      stepsCount?: number
    }
    if (!sessionId || !variant || !taskId || !Number.isInteger(stepReached)) {
      return NextResponse.json({ error: 'sessionId, variant, taskId, stepReached required' }, { status: 400 })
    }
    if (!['a', 'b'].includes(variant)) {
      return NextResponse.json({ error: 'Invalid variant' }, { status: 400 })
    }
    const steps = Array.isArray(stepTimes) ? stepTimes : []
    const now = new Date().toISOString()
    const { error } = await supabaseAdmin.from('pear_navigator_sessions').upsert(
      {
        session_id: sessionId,
        variant,
        task_id: taskId,
        step_reached: stepReached,
        step_times: steps,
        completed: completed ?? false,
        rating: completed && rating ? rating : null,
      total_sec: completed && Number.isFinite(totalSec) ? Math.round(totalSec ?? 0) : null,
      steps_count: completed && Number.isFinite(stepsCount) ? Math.round(stepsCount ?? 0) : null,
        updated_at: now,
      },
      { onConflict: 'session_id', ignoreDuplicates: false }
    )
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    if (completed && rating && Number.isFinite(totalSec) && Number.isFinite(stepsCount)) {
      const ts = Math.round(totalSec ?? 0)
      const sc = Math.round(stepsCount ?? 0)
      await supabaseAdmin.from('pear_navigator_ab_results').insert({
        variant,
        task_id: taskId,
        rating,
        total_sec: ts,
        avg_sec_per_step: sc > 0 ? Math.round(ts / sc) : 0,
        steps_count: sc,
      })
    }
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
