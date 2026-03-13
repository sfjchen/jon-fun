'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

type SessionRow = {
  id: string
  sessionId: string | null
  variant: string
  taskId: string
  stepReached: number
  stepTimes: number[]
  completed: boolean
  rating: string | null
  totalSec: number | null
  stepsCount: number | null
  createdAt: string
  updatedAt: string
}

const TASK_LABELS: Record<string, string> = {
  procreateSky: 'Your first painting!',
  figmaBusinessCard: 'Design a business card',
  figmaMindmap: 'Create a mindmap',
}

const TASK_STEPS: Record<string, number> = {
  procreateSky: 16,
  figmaBusinessCard: 10,
  figmaMindmap: 10,
}

const TASK_ORDER = ['procreateSky', 'figmaBusinessCard', 'figmaMindmap'] as const

function chiSquare2x2(aYes: number, aNo: number, bYes: number, bNo: number): { chi2: number; p: number } {
  const total = aYes + aNo + bYes + bNo
  if (total === 0) return { chi2: 0, p: 1 }
  const row1 = aYes + aNo
  const row2 = bYes + bNo
  const col1 = aYes + bYes
  const col2 = aNo + bNo
  const e11 = (row1 * col1) / total
  const e12 = (row1 * col2) / total
  const e21 = (row2 * col1) / total
  const e22 = (row2 * col2) / total
  const chi2 = (e11 ? ((aYes - e11) ** 2) / e11 : 0) + (e12 ? ((aNo - e12) ** 2) / e12 : 0) + (e21 ? ((bYes - e21) ** 2) / e21 : 0) + (e22 ? ((bNo - e22) ** 2) / e22 : 0)
  const p = chi2 > 0 ? Math.max(0.001, Math.exp(-chi2 / 2) * (1 + chi2 / 2)) : 1
  return { chi2, p }
}

function tTestTwoSample(a: number[], b: number[]): { t: number; p: number } {
  const n1 = a.length
  const n2 = b.length
  if (n1 < 2 || n2 < 2) return { t: 0, p: 1 }
  const m1 = a.reduce((s, x) => s + x, 0) / n1
  const m2 = b.reduce((s, x) => s + x, 0) / n2
  const v1 = a.reduce((s, x) => s + (x - m1) ** 2, 0) / (n1 - 1)
  const v2 = b.reduce((s, x) => s + (x - m2) ** 2, 0) / (n2 - 1)
  const se = Math.sqrt(v1 / n1 + v2 / n2)
  if (se === 0) return { t: 0, p: 1 }
  const t = Math.abs(m1 - m2) / se
  const df = Math.min(n1 - 1, n2 - 1)
  const p = Math.max(0.001, 1 - t / (t + df))
  return { t, p }
}

function chiSquareRatings(a: Record<string, number>, b: Record<string, number>): { chi2: number; p: number } {
  const cats = ['meh', 'good', 'great']
  const oa = cats.map((c) => a[c] ?? 0)
  const ob = cats.map((c) => b[c] ?? 0)
  const row1 = oa.reduce((s, x) => s + x, 0)
  const row2 = ob.reduce((s, x) => s + x, 0)
  const total = row1 + row2
  if (total === 0) return { chi2: 0, p: 1 }
  let chi2 = 0
  for (let i = 0; i < 3; i++) {
    const colTotal = oa[i]! + ob[i]!
    const expected = (row1 * colTotal) / total
    if (expected > 0) chi2 += ((oa[i]! - expected) ** 2) / expected
    const expected2 = (row2 * colTotal) / total
    if (expected2 > 0) chi2 += ((ob[i]! - expected2) ** 2) / expected2
  }
  const p = chi2 > 0 ? Math.max(0.001, Math.exp(-chi2 / 2) * (1 + chi2 / 2 + chi2 ** 2 / 8)) : 1
  return { chi2, p }
}

export default function PearNavigatorResultsPage() {
  const [rows, setRows] = useState<SessionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/pear-navigator/sessions')
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error)
        setRows(d.rows ?? [])
      })
      .catch((e) => setError(e.message ?? 'Failed to load'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12">
        <p className="text-gray-500">Loading results…</p>
      </div>
    )
  }
  if (error) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12">
        <p className="text-red-500">{error}</p>
        <Link href="/games/pear-navigator" className="mt-4 inline-block text-[var(--ink-accent)] hover:underline">
          ← Back to Pear Navigator
        </Link>
      </div>
    )
  }

  const byTask = {} as Record<string, { completed: SessionRow[]; dropped: SessionRow[] }>
  for (const tid of TASK_ORDER) {
    byTask[tid] = { completed: [], dropped: [] }
  }
  for (const r of rows) {
    const t = byTask[r.taskId]
    if (t) (r.completed ? t.completed : t.dropped).push(r)
  }

  const completions = rows.filter((r) => r.completed)
  const dropouts = rows.filter((r) => !r.completed)

  const completedByVariant = { a: completions.filter((r) => r.variant === 'a'), b: completions.filter((r) => r.variant === 'b') }
  const compTest = chiSquare2x2(
    completedByVariant.a.length,
    dropouts.filter((r) => r.variant === 'a').length,
    completedByVariant.b.length,
    dropouts.filter((r) => r.variant === 'b').length
  )

  const timesA = completedByVariant.a.map((r) => r.totalSec ?? 0).filter((x) => x > 0)
  const timesB = completedByVariant.b.map((r) => r.totalSec ?? 0).filter((x) => x > 0)
  const timeTest = tTestTwoSample(timesA, timesB)

  const ratingsA = { meh: 0, good: 0, great: 0 }
  const ratingsB = { meh: 0, good: 0, great: 0 }
  for (const r of completedByVariant.a) {
    if (r.rating && r.rating in ratingsA) ratingsA[r.rating as keyof typeof ratingsA]++
  }
  for (const r of completedByVariant.b) {
    if (r.rating && r.rating in ratingsB) ratingsB[r.rating as keyof typeof ratingsB]++
  }
  const ratingTest = chiSquareRatings(ratingsA, ratingsB)

  const formatP = (p: number) => (p < 0.001 ? '<0.001' : p.toFixed(3))
  const sig = (p: number) => (p < 0.05 ? ' *' : '')

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--ink-text)' }}>
          Pear Navigator A/B Test Results
        </h1>
        <Link href="/games/pear-navigator" className="text-sm hover:opacity-80" style={{ color: 'var(--ink-accent)' }}>
          ← Back to demo
        </Link>
      </div>

      {/* Statistical tests */}
      <div className="mb-8 rounded-lg border p-6" style={{ backgroundColor: 'var(--ink-paper)', borderColor: 'var(--ink-border)' }}>
        <h2 className="mb-4 text-lg font-semibold" style={{ color: 'var(--ink-text)' }}>
          Statistical tests
        </h2>
        <p className="mb-2 text-xs" style={{ color: 'var(--ink-muted)' }}>* p &lt; 0.05</p>
        <div className="space-y-3 text-sm">
          <div>
            <strong>Completion rate (A vs B):</strong> χ²={compTest.chi2.toFixed(2)}, p={formatP(compTest.p)}{sig(compTest.p)}
          </div>
          <div>
            <strong>Time to complete (A vs B):</strong> t={timeTest.t.toFixed(2)}, p={formatP(timeTest.p)}{sig(timeTest.p)}
          </div>
          <div>
            <strong>Rating distribution (A vs B):</strong> χ²={ratingTest.chi2.toFixed(2)}, p={formatP(ratingTest.p)}{sig(ratingTest.p)}
          </div>
        </div>
      </div>

      {/* By task */}
      {TASK_ORDER.map((taskId) => {
        const { completed, dropped } = byTask[taskId] ?? { completed: [], dropped: [] }
        const total = completed.length + dropped.length
        const stepsCount = TASK_STEPS[taskId] ?? completed[0]?.stepsCount ?? 0
        const compA = completed.filter((r) => r.variant === 'a')
        const compB = completed.filter((r) => r.variant === 'b')
        const dropA = dropped.filter((r) => r.variant === 'a')
        const dropB = dropped.filter((r) => r.variant === 'b')
        const avgStepDrop = dropped.length ? (dropped.reduce((s, r) => s + r.stepReached + 1, 0) / dropped.length).toFixed(1) : '-'
        const avgTimeDrop = dropped.length ? Math.round(dropped.reduce((s, r) => {
          const t = r.stepTimes?.reduce((a, b) => a + b, 0) ?? 0
          return s + t
        }, 0) / dropped.length) : 0

        return (
          <div key={taskId} className="mb-8 rounded-lg border p-6" style={{ backgroundColor: 'var(--ink-paper)', borderColor: 'var(--ink-border)' }}>
            <h2 className="mb-4 text-lg font-semibold" style={{ color: 'var(--ink-text)' }}>
              {TASK_LABELS[taskId] ?? taskId}
            </h2>
            <p className="mb-4 text-sm" style={{ color: 'var(--ink-muted)' }}>
              Total sessions: <strong>{total}</strong> · Finished: <strong>{completed.length}</strong> · Dropped: <strong>{dropped.length}</strong>
            </p>
            <div className="grid gap-4 sm:grid-cols-2 mb-4">
              <div className="rounded border p-4" style={{ borderColor: 'var(--ink-border)' }}>
                <h3 className="mb-2 font-medium" style={{ color: 'var(--ink-text)' }}>Variant A</h3>
                <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>Completed: {compA.length} · Dropped: {dropA.length}</p>
                {compA.length > 0 && (
                  <p className="text-sm mt-1" style={{ color: 'var(--ink-muted)' }}>
                    Avg time (completed): {Math.round(compA.reduce((s, r) => s + (r.totalSec ?? 0), 0) / compA.length)}s
                  </p>
                )}
                {compA.length > 0 && (
                  <p className="text-xs mt-1" style={{ color: 'var(--ink-muted)' }}>
                    meh:{compA.filter((r) => r.rating === 'meh').length} good:{compA.filter((r) => r.rating === 'good').length} great:{compA.filter((r) => r.rating === 'great').length}
                  </p>
                )}
              </div>
              <div className="rounded border p-4" style={{ borderColor: 'var(--ink-border)' }}>
                <h3 className="mb-2 font-medium" style={{ color: 'var(--ink-text)' }}>Variant B</h3>
                <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>Completed: {compB.length} · Dropped: {dropB.length}</p>
                {compB.length > 0 && (
                  <p className="text-sm mt-1" style={{ color: 'var(--ink-muted)' }}>
                    Avg time (completed): {Math.round(compB.reduce((s, r) => s + (r.totalSec ?? 0), 0) / compB.length)}s
                  </p>
                )}
                {compB.length > 0 && (
                  <p className="text-xs mt-1" style={{ color: 'var(--ink-muted)' }}>
                    meh:{compB.filter((r) => r.rating === 'meh').length} good:{compB.filter((r) => r.rating === 'good').length} great:{compB.filter((r) => r.rating === 'great').length}
                  </p>
                )}
              </div>
            </div>
            {dropped.length > 0 && (
              <div className="rounded border p-3" style={{ borderColor: 'var(--ink-border)', color: 'var(--ink-muted)' }}>
                <p className="text-sm">Dropouts: avg step reached {avgStepDrop} of {stepsCount || '?'} · avg time when left {avgTimeDrop}s</p>
              </div>
            )}
          </div>
        )
      })}

      {/* Recent sessions */}
      <div className="rounded-lg border overflow-hidden" style={{ backgroundColor: 'var(--ink-paper)', borderColor: 'var(--ink-border)' }}>
        <h2 className="border-b px-4 py-3 text-lg font-semibold" style={{ borderColor: 'var(--ink-border)', color: 'var(--ink-text)' }}>
          Recent sessions
        </h2>
        <div className="max-h-[400px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-[var(--ink-paper)]">
              <tr className="border-b" style={{ borderColor: 'var(--ink-border)' }}>
                <th className="px-4 py-2 text-left font-medium" style={{ color: 'var(--ink-text)' }}>When</th>
                <th className="px-4 py-2 text-left font-medium" style={{ color: 'var(--ink-text)' }}>Task</th>
                <th className="px-4 py-2 text-left font-medium" style={{ color: 'var(--ink-text)' }}>Variant</th>
                <th className="px-4 py-2 text-left font-medium" style={{ color: 'var(--ink-text)' }}>Step</th>
                <th className="px-4 py-2 text-left font-medium" style={{ color: 'var(--ink-text)' }}>Status</th>
                <th className="px-4 py-2 text-right font-medium" style={{ color: 'var(--ink-text)' }}>Time</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 100).map((r) => (
                <tr key={r.id} className="border-b" style={{ borderColor: 'var(--ink-border)' }}>
                  <td className="px-4 py-2" style={{ color: 'var(--ink-muted)' }}>{new Date(r.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-2" style={{ color: 'var(--ink-text)' }}>{TASK_LABELS[r.taskId] ?? r.taskId}</td>
                  <td className="px-4 py-2" style={{ color: 'var(--ink-text)' }}>{r.variant}</td>
                  <td className="px-4 py-2" style={{ color: 'var(--ink-text)' }}>{r.stepReached + 1}</td>
                  <td className="px-4 py-2" style={{ color: 'var(--ink-text)' }}>{r.completed ? 'Done' : 'Dropped'}</td>
                  <td className="px-4 py-2 text-right" style={{ color: 'var(--ink-muted)' }}>
                    {r.totalSec != null ? `${r.totalSec}s` : r.stepTimes?.length ? `${r.stepTimes.reduce((a, b) => a + b, 0)}s` : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
