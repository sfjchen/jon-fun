'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

type Row = {
  id: string
  variant: string
  taskId: string
  rating: string
  totalSec: number
  avgSecPerStep: number
  stepsCount: number
  createdAt: string
}

type Summary = {
  total: number
  byVariant: {
    a: { count: number; avgSec: number; ratings: { meh: number; good: number; great: number } }
    b: { count: number; avgSec: number; ratings: { meh: number; good: number; great: number } }
  }
  byTask: Record<string, { count: number; avgSec: number; ratings: { meh: number; good: number; great: number } }>
}

const TASK_LABELS: Record<string, string> = {
  procreateSky: 'Your first painting!',
  figmaBusinessCard: 'Design a business card',
  figmaMindmap: 'Create a mindmap',
}

export default function PearNavigatorResultsPage() {
  const [data, setData] = useState<{ rows: Row[]; summary: Summary } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/pear-navigator/results')
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error)
        setData(d)
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
  if (error || !data) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12">
        <p className="text-red-500">{error ?? 'No data'}</p>
        <Link href="/games/pear-navigator" className="mt-4 inline-block text-[var(--ink-accent)] hover:underline">
          ← Back to Pear Navigator
        </Link>
      </div>
    )
  }

  const { rows, summary } = data

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--ink-text)' }}>
          Pear Navigator A/B Test Results
        </h1>
        <Link
          href="/games/pear-navigator"
          className="text-sm hover:opacity-80"
          style={{ color: 'var(--ink-accent)' }}
        >
          ← Back to demo
        </Link>
      </div>

      <div className="mb-8 rounded-lg border p-6" style={{ backgroundColor: 'var(--ink-paper)', borderColor: 'var(--ink-border)' }}>
        <h2 className="mb-4 text-lg font-semibold" style={{ color: 'var(--ink-text)' }}>
          Summary
        </h2>
        <p className="mb-4 text-sm" style={{ color: 'var(--ink-muted)' }}>
          Total responses: <strong>{summary.total}</strong>
        </p>
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="rounded border p-4" style={{ borderColor: 'var(--ink-border)' }}>
            <h3 className="mb-2 font-medium" style={{ color: 'var(--ink-text)' }}>Variant A (tap simulator)</h3>
            <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>Count: {summary.byVariant.a.count} · Avg time: {summary.byVariant.a.avgSec}s</p>
            <p className="mt-1 text-xs" style={{ color: 'var(--ink-muted)' }}>
              Meh: {summary.byVariant.a.ratings.meh} · Good: {summary.byVariant.a.ratings.good} · Great: {summary.byVariant.a.ratings.great}
            </p>
          </div>
          <div className="rounded border p-4" style={{ borderColor: 'var(--ink-border)' }}>
            <h3 className="mb-2 font-medium" style={{ color: 'var(--ink-text)' }}>Variant B (Next step button)</h3>
            <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>Count: {summary.byVariant.b.count} · Avg time: {summary.byVariant.b.avgSec}s</p>
            <p className="mt-1 text-xs" style={{ color: 'var(--ink-muted)' }}>
              Meh: {summary.byVariant.b.ratings.meh} · Good: {summary.byVariant.b.ratings.good} · Great: {summary.byVariant.b.ratings.great}
            </p>
          </div>
        </div>
        <div className="mt-4">
          <h3 className="mb-2 font-medium" style={{ color: 'var(--ink-text)' }}>By task</h3>
          <div className="flex flex-wrap gap-3">
            {Object.entries(summary.byTask).map(([taskId, v]) => (
              <div key={taskId} className="rounded border px-3 py-2 text-sm" style={{ borderColor: 'var(--ink-border)', color: 'var(--ink-muted)' }}>
                {TASK_LABELS[taskId] ?? taskId}: {v.count} · {v.avgSec}s avg · meh:{v.ratings.meh} good:{v.ratings.good} great:{v.ratings.great}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-lg border overflow-hidden" style={{ backgroundColor: 'var(--ink-paper)', borderColor: 'var(--ink-border)' }}>
        <h2 className="border-b px-4 py-3 text-lg font-semibold" style={{ borderColor: 'var(--ink-border)', color: 'var(--ink-text)' }}>
          Recent submissions
        </h2>
        <div className="max-h-[400px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-[var(--ink-paper)]">
              <tr className="border-b" style={{ borderColor: 'var(--ink-border)' }}>
                <th className="px-4 py-2 text-left font-medium" style={{ color: 'var(--ink-text)' }}>When</th>
                <th className="px-4 py-2 text-left font-medium" style={{ color: 'var(--ink-text)' }}>Variant</th>
                <th className="px-4 py-2 text-left font-medium" style={{ color: 'var(--ink-text)' }}>Task</th>
                <th className="px-4 py-2 text-left font-medium" style={{ color: 'var(--ink-text)' }}>Rating</th>
                <th className="px-4 py-2 text-right font-medium" style={{ color: 'var(--ink-text)' }}>Time</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b" style={{ borderColor: 'var(--ink-border)' }}>
                  <td className="px-4 py-2" style={{ color: 'var(--ink-muted)' }}>
                    {new Date(r.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-2" style={{ color: 'var(--ink-text)' }}>{r.variant}</td>
                  <td className="px-4 py-2" style={{ color: 'var(--ink-text)' }}>{TASK_LABELS[r.taskId] ?? r.taskId}</td>
                  <td className="px-4 py-2 capitalize" style={{ color: 'var(--ink-text)' }}>{r.rating}</td>
                  <td className="px-4 py-2 text-right" style={{ color: 'var(--ink-muted)' }}>{r.totalSec}s</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
