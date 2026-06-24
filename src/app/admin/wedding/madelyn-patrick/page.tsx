'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import type { WeddingRsvpRow } from '@/app/api/wedding/admin/rsvps/route'

const ADMIN_KEY = 'wedding_admin_ok'

type Summary = {
  totalResponses: number
  attendingCount: number
  declinedCount: number
  estimatedHeadcount: number
}

function toCsv(rows: WeddingRsvpRow[]): string {
  const header = ['guest_name', 'attending', 'plus_one_name', 'dietary', 'email', 'message', 'created_at']
  const esc = (v: string | boolean | null) => {
    const s = v == null ? '' : String(v)
    if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`
    return s
  }
  const lines = [header.join(',')]
  for (const r of rows) {
    lines.push(
      [r.guest_name, r.attending, r.plus_one_name, r.dietary, r.email, r.message, r.created_at].map(esc).join(',')
    )
  }
  return lines.join('\n')
}

export default function WeddingAdminPage() {
  const [key, setKey] = useState('')
  const [authorized, setAuthorized] = useState(false)
  const [rsvps, setRsvps] = useState<WeddingRsvpRow[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchRsvps = useCallback(async (adminKey: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/wedding/admin/rsvps?key=${encodeURIComponent(adminKey)}`)
      if (res.status === 401) {
        setError('Invalid key')
        setLoading(false)
        return
      }
      if (!res.ok) {
        setError('Failed to load')
        setLoading(false)
        return
      }
      const data = (await res.json()) as { rsvps: WeddingRsvpRow[]; summary: Summary }
      setRsvps(data.rsvps ?? [])
      setSummary(data.summary ?? null)
      setAuthorized(true)
      if (typeof window !== 'undefined') window.sessionStorage.setItem(ADMIN_KEY, adminKey)
    } catch {
      setError('Request failed')
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const q = new URLSearchParams(window.location.search)
    const urlKey = q.get('key')
    const stored = window.sessionStorage.getItem(ADMIN_KEY)
    if (urlKey) void fetchRsvps(urlKey)
    else if (stored) void fetchRsvps(stored)
  }, [fetchRsvps])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (key.trim()) void fetchRsvps(key.trim())
  }

  const downloadCsv = () => {
    const csv = toCsv(rsvps)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `wedding-rsvps-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!authorized) {
    return (
      <div className="mx-auto max-w-md py-12">
        <h1 className="font-lora text-2xl font-semibold">Wedding RSVP Admin</h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--ink-muted)' }}>
          Madelyn &amp; Patrick — enter admin secret
        </p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="Admin secret"
            className="w-full rounded-lg border px-3 py-2"
            style={{ borderColor: 'var(--ink-border)' }}
          />
          {error && (
            <p className="text-sm" style={{ color: 'var(--ink-accent)' }}>
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg px-4 py-2 text-white disabled:opacity-60"
            style={{ backgroundColor: 'var(--ink-accent)' }}
          >
            {loading ? 'Loading…' : 'Enter'}
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className="py-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-lora text-2xl font-semibold">Wedding RSVPs</h1>
          <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
            Madelyn &amp; Patrick
          </p>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={downloadCsv}
            className="rounded-lg border px-4 py-2 text-sm"
            style={{ borderColor: 'var(--ink-border)' }}
          >
            Export CSV
          </button>
          <Link href="/wedding/madelyn-patrick" className="rounded-lg px-4 py-2 text-sm text-white" style={{ backgroundColor: 'var(--ink-accent)' }}>
            View site
          </Link>
        </div>
      </div>

      {summary && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ['Responses', summary.totalResponses],
            ['Attending', summary.attendingCount],
            ['Declined', summary.declinedCount],
            ['Est. headcount', summary.estimatedHeadcount],
          ].map(([label, val]) => (
            <div key={String(label)} className="rounded-lg border p-4" style={{ borderColor: 'var(--ink-border)', backgroundColor: 'var(--ink-paper)' }}>
              <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--ink-muted)' }}>
                {label}
              </p>
              <p className="mt-1 text-2xl font-semibold">{val}</p>
            </div>
          ))}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--ink-border)' }}>
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead style={{ backgroundColor: 'var(--ink-paper)' }}>
            <tr>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Attending</th>
              <th className="px-3 py-2 font-medium">Plus-one</th>
              <th className="px-3 py-2 font-medium">Dietary</th>
              <th className="px-3 py-2 font-medium">Email</th>
              <th className="px-3 py-2 font-medium">Submitted</th>
            </tr>
          </thead>
          <tbody>
            {rsvps.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center" style={{ color: 'var(--ink-muted)' }}>
                  No responses yet
                </td>
              </tr>
            ) : (
              rsvps.map((r) => (
                <tr key={r.id} className="border-t" style={{ borderColor: 'var(--ink-border)' }}>
                  <td className="px-3 py-2">{r.guest_name}</td>
                  <td className="px-3 py-2">{r.attending ? 'Yes' : 'No'}</td>
                  <td className="px-3 py-2">{r.plus_one_name ?? '—'}</td>
                  <td className="max-w-[160px] truncate px-3 py-2" title={r.dietary ?? undefined}>
                    {r.dietary ?? '—'}
                  </td>
                  <td className="px-3 py-2">{r.email ?? '—'}</td>
                  <td className="whitespace-nowrap px-3 py-2">{new Date(r.created_at).toLocaleString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
