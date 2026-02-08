'use client'

import Link from 'next/link'
import { useState, useEffect, useCallback } from 'react'

const TMR_ADMIN_KEY = 'tmr_admin_ok'

type StudyRow = {
  id: string
  user_id: string
  start: string
  end: string
  duration_minutes: number
  cues_played: number
  cue_interval_seconds: number
  interrupted: boolean
  created_at: string
}
type SleepRow = {
  id: string
  user_id: string
  start: string
  end: string
  duration_minutes: number
  total_cues: number
  cycles: number
  created_at: string
}

export default function TMRAdminPage() {
  const [key, setKey] = useState('')
  const [authorized, setAuthorized] = useState(false)
  const [studySessions, setStudySessions] = useState<StudyRow[]>([])
  const [sleepSessions, setSleepSessions] = useState<SleepRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchEntries = useCallback(async (adminKey: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/tmr/admin/entries?key=${encodeURIComponent(adminKey)}`)
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
      const data = (await res.json()) as { studySessions: StudyRow[]; sleepSessions: SleepRow[] }
      setStudySessions(data.studySessions ?? [])
      setSleepSessions(data.sleepSessions ?? [])
      setAuthorized(true)
      if (typeof window !== 'undefined') window.sessionStorage.setItem(TMR_ADMIN_KEY, adminKey)
    } catch {
      setError('Request failed')
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const q = new URLSearchParams(window.location.search)
    const urlKey = q.get('key')
    const stored = window.sessionStorage.getItem(TMR_ADMIN_KEY)
    if (urlKey) {
      void fetchEntries(urlKey)
      return
    }
    if (stored) void fetchEntries(stored)
  }, [fetchEntries])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (key.trim()) void fetchEntries(key.trim())
  }

  const exportJson = useCallback(() => {
    const blob = new Blob(
      [JSON.stringify({ studySessions, sleepSessions }, null, 2)],
      { type: 'application/json' }
    )
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'tmr-sessions.json'
    a.click()
    URL.revokeObjectURL(a.href)
  }, [studySessions, sleepSessions])

  const exportCsv = useCallback(() => {
    const studyLines = [
      'type,user_id,start,end,duration_minutes,cues_played,cue_interval_seconds,interrupted,created_at',
      ...studySessions.map(
        (s) =>
          `study,${s.user_id},${s.start},${s.end},${s.duration_minutes},${s.cues_played},${s.cue_interval_seconds},${s.interrupted},${s.created_at}`
      ),
    ]
    const sleepLines = [
      'type,user_id,start,end,duration_minutes,total_cues,cycles,created_at',
      ...sleepSessions.map(
        (s) =>
          `sleep,${s.user_id},${s.start},${s.end},${s.duration_minutes},${s.total_cues},${s.cycles},${s.created_at}`
      ),
    ]
    const csv = [...studyLines, '', ...sleepLines].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'tmr-sessions.csv'
    a.click()
    URL.revokeObjectURL(a.href)
  }, [studySessions, sleepSessions])

  const copyText = useCallback(() => {
    const lines: string[] = []
    studySessions.forEach((s) => {
      lines.push(`[Study] ${s.start} – ${s.end} | ${s.duration_minutes.toFixed(1)} min | ${s.cues_played} cues`)
    })
    sleepSessions.forEach((s) => {
      lines.push(`[Sleep] ${s.start} – ${s.end} | ${s.duration_minutes.toFixed(1)} min | ${s.total_cues} cues | ${s.cycles} cycles`)
    })
    navigator.clipboard.writeText(lines.join('\n'))
  }, [studySessions, sleepSessions])

  const formatDate = (s: string) =>
    new Date(s).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })

  if (!authorized && !loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-4 flex items-center justify-center">
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20 max-w-md w-full">
          <h1 className="text-2xl font-bold text-white mb-4">TMR Admin</h1>
          <form onSubmit={handleSubmit}>
            <input
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="Admin key"
              className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white placeholder-gray-500 mb-4"
              autoComplete="off"
            />
            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg">
              View logs
            </button>
          </form>
          {error && <p className="text-red-400 mt-2 text-sm">{error}</p>}
          <Link href="/" className="block text-gray-300 mt-4 text-sm hover:text-white">
            ← Back to hub
          </Link>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-4 flex items-center justify-center">
        <p className="text-white">Loading…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-4">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <Link href="/" className="text-white hover:text-gray-300 text-2xl font-bold">
            ← Back
          </Link>
          <h1 className="text-4xl font-bold text-white">TMR Admin – All sessions</h1>
          <div className="w-16" />
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={exportJson}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white"
          >
            Download JSON
          </button>
          <button
            onClick={exportCsv}
            className="px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white hover:bg-white/20"
          >
            Download CSV
          </button>
          <button
            onClick={copyText}
            className="px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white hover:bg-white/20"
          >
            Copy as text
          </button>
        </div>

        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20 mb-6">
          <h2 className="text-2xl font-bold text-white mb-4">Study sessions ({studySessions.length})</h2>
          {studySessions.length === 0 ? (
            <p className="text-gray-300">No study sessions.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-gray-300 border-b border-white/20">
                    <th className="py-2 pr-4">User</th>
                    <th className="py-2 pr-4">Start</th>
                    <th className="py-2 pr-4">End</th>
                    <th className="py-2 pr-4">Duration</th>
                    <th className="py-2 pr-4">Cues</th>
                    <th className="py-2">Int.</th>
                  </tr>
                </thead>
                <tbody>
                  {studySessions.map((s) => (
                    <tr key={s.id} className="border-b border-white/10 text-white">
                      <td className="py-2 pr-4 font-mono text-xs">{s.user_id.slice(0, 8)}…</td>
                      <td className="py-2 pr-4">{formatDate(s.start)}</td>
                      <td className="py-2 pr-4">{formatDate(s.end)}</td>
                      <td className="py-2 pr-4">{s.duration_minutes.toFixed(1)} m</td>
                      <td className="py-2 pr-4">{s.cues_played}</td>
                      <td className="py-2">{s.interrupted ? 'Yes' : 'No'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
          <h2 className="text-2xl font-bold text-white mb-4">Sleep sessions ({sleepSessions.length})</h2>
          {sleepSessions.length === 0 ? (
            <p className="text-gray-300">No sleep sessions.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-gray-300 border-b border-white/20">
                    <th className="py-2 pr-4">User</th>
                    <th className="py-2 pr-4">Start</th>
                    <th className="py-2 pr-4">End</th>
                    <th className="py-2 pr-4">Duration</th>
                    <th className="py-2 pr-4">Cues</th>
                    <th className="py-2">Cycles</th>
                  </tr>
                </thead>
                <tbody>
                  {sleepSessions.map((s) => (
                    <tr key={s.id} className="border-b border-white/10 text-white">
                      <td className="py-2 pr-4 font-mono text-xs">{s.user_id.slice(0, 8)}…</td>
                      <td className="py-2 pr-4">{formatDate(s.start)}</td>
                      <td className="py-2 pr-4">{formatDate(s.end)}</td>
                      <td className="py-2 pr-4">{s.duration_minutes.toFixed(1)} m</td>
                      <td className="py-2 pr-4">{s.total_cues}</td>
                      <td className="py-2">{s.cycles}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
