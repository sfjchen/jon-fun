import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    if (!userId?.trim()) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 })
    }
    const { data, error } = await supabase
      .from('daily_learn_entries')
      .select('date, text, updated_at')
      .eq('user_id', userId.trim())
      .order('date', { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const entries = (data ?? []).map((r) => ({
      date: r.date,
      text: r.text ?? '',
      updatedAt: r.updated_at ?? new Date().toISOString(),
    }))
    return NextResponse.json({ entries })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, entries } = body as {
      userId: string
      entries?: Array<{ date: string; text: string }>
    }
    if (!userId?.trim()) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 })
    }
    const toUpsert = Array.isArray(entries) ? entries : []
    if (toUpsert.length === 0) return NextResponse.json({ ok: true })
    const rows = toUpsert.map((e) => ({
      user_id: userId.trim(),
      date: e.date,
      text: e.text ?? '',
      updated_at: new Date().toISOString(),
    }))
    const { error } = await supabase.from('daily_learn_entries').upsert(rows, {
      onConflict: 'user_id,date',
      ignoreDuplicates: false,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const date = searchParams.get('date')
    if (!userId?.trim() || !date?.trim()) {
      return NextResponse.json({ error: 'userId and date required' }, { status: 400 })
    }
    const { error } = await supabase
      .from('daily_learn_entries')
      .delete()
      .eq('user_id', userId.trim())
      .eq('date', date.trim())
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
