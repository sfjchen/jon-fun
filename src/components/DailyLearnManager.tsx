'use client'

import Link from 'next/link'
import { useState, useEffect, useCallback } from 'react'
import {
  loadEntries,
  saveEntry,
  getEntryByDate,
  getTodayDate,
  getCounts,
  exportAsText,
  exportAsJson,
  getOrCreateUserId,
  getSyncKey,
  setSyncKey,
  syncWithServer,
  restoreFromServer,
  parseLocalDate,
  capitalizeFirst,
  type DailyLearnEntry,
} from '@/lib/dailyLearn'

type View = 'log' | 'analytics' | 'export' | 'sync'

export default function DailyLearnManager() {
  const [view, setView] = useState<View>('log')
  const [entries, setEntries] = useState<DailyLearnEntry[]>([])
  const [todayText, setTodayText] = useState('')
  const [saved, setSaved] = useState(false)
  const [editingDate, setEditingDate] = useState<string | null>(null)
  const [editingText, setEditingText] = useState('')
  const [calYear, setCalYear] = useState(() => new Date().getFullYear())
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth())
  const [syncKeyInput, setSyncKeyInput] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [restoreKey, setRestoreKey] = useState('')
  const [restoring, setRestoring] = useState(false)
  const [restoreResult, setRestoreResult] = useState<string | null>(null)

  const refresh = useCallback(() => {
    setEntries(loadEntries())
  }, [])

  useEffect(() => {
    getOrCreateUserId()
    refresh()
  }, [refresh])

  useEffect(() => {
    if (!getSyncKey()) return
    setSyncing(true)
    syncWithServer()
      .then(() => refresh())
      .finally(() => setSyncing(false))
  }, [refresh])

  useEffect(() => {
    const d = getTodayDate()
    setTodayText(getEntryByDate(d)?.text ?? '')
  }, [view, entries])

  const handleSubmit = useCallback(() => {
    const date = getTodayDate()
    saveEntry({ date, text: todayText.trim() })
    setSaved(true)
    refresh()
    setTimeout(() => setSaved(false), 2000)
  }, [todayText, refresh])

  const handleSaveEdit = useCallback(() => {
    if (!editingDate) return
    saveEntry({ date: editingDate, text: editingText.trim() })
    setEditingDate(null)
    setEditingText('')
    refresh()
  }, [editingDate, editingText, refresh])

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(exportAsText())
  }, [])
  const handleDownload = useCallback(() => {
    const blob = new Blob([exportAsJson()], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'daily-learn-entries.json'
    a.click()
    URL.revokeObjectURL(a.href)
  }, [])

  const counts = getCounts()
  const calendarDates = new Set(entries.map((e) => e.date))
  const [today, setToday] = useState<string | null>(null)
  useEffect(() => {
    setToday(getTodayDate())
  }, [])

  const layout = (title: string, children: React.ReactNode) => (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <Link
            href="/"
            className="text-white hover:text-gray-300 text-2xl font-bold"
            aria-label="Back to home"
          >
            ← Home
          </Link>
          <h1 className="text-4xl font-bold text-white">{title}</h1>
          <div className="w-16" />
        </div>
        {children}
      </div>
    </div>
  )

  const year = calYear
  const month = calMonth
  const first = new Date(year, month, 1)
  const last = new Date(year, month + 1, 0)
  const startPad = first.getDay()
  const daysInMonth = last.getDate()
  const calendarCells: (number | null)[] = []
  for (let i = 0; i < startPad; i++) calendarCells.push(null)
  for (let d = 1; d <= daysInMonth; d++) calendarCells.push(d)
  const dateStr = (d: number) => `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`

  const editModal = editingDate && (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20 max-w-lg w-full">
        <h3 className="text-xl font-bold text-white mb-2">Edit {parseLocalDate(editingDate).toLocaleDateString()}</h3>
        <textarea
          value={editingText}
          onChange={(e) => setEditingText(e.target.value)}
          className="w-full min-h-[100px] px-4 py-3 rounded-lg bg-white/5 border border-white/20 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          autoFocus
        />
        <div className="mt-4 flex gap-2">
          <button onClick={handleSaveEdit} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg">
            Save
          </button>
          <button onClick={() => { setEditingDate(null); setEditingText('') }} className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg border border-white/20">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )

  if (view === 'log') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <Link href="/" className="text-white hover:text-gray-300 text-2xl font-bold" aria-label="Back to home">
              ← Home
            </Link>
            <h1 className="text-4xl font-bold text-white">1 Sentence Everyday</h1>
            {syncing ? <span className="text-gray-400 text-sm">Syncing…</span> : <div className="w-16" />}
          </div>

          {entries.length === 0 && (
            <div className="bg-amber-500/20 border border-amber-500/50 rounded-2xl p-4 mb-6">
              <p className="text-amber-200 font-medium">Restore your logs</p>
              <p className="text-amber-200/90 text-sm mt-1">
                Go to <button type="button" onClick={() => setView('sync')} className="underline">Sync</button> tab → enter <code className="bg-white/10 px-1 rounded">sfjc</code> → Restore. Do this on each device.
              </p>
            </div>
          )}
          {/* Calendar */}
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20 mb-6">
            <div className="flex items-center justify-between mb-4">
              <button
                type="button"
                onClick={() => {
                  if (month === 0) { setCalMonth(11); setCalYear((y) => y - 1) }
                  else setCalMonth((m) => m - 1)
                }}
                className="text-white hover:text-gray-300 px-2 py-1"
              >
                ←
              </button>
              <h2 className="text-2xl font-bold text-white">
                {new Date(year, month).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
              </h2>
              <button
                type="button"
                onClick={() => {
                  if (month === 11) { setCalMonth(0); setCalYear((y) => y + 1) }
                  else setCalMonth((m) => m + 1)
                }}
                className="text-white hover:text-gray-300 px-2 py-1"
              >
                →
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                <div key={d} className="text-gray-400 text-sm font-medium py-1">
                  {d}
                </div>
              ))}
              {calendarCells.map((d, i) => {
                if (d === null) return <div key={`e-${i}`} />;
                const ds = dateStr(d)
                const hasEntry = calendarDates.has(ds)
                const entry = getEntryByDate(ds)
                return (
                  <button
                    key={ds}
                    type="button"
                    onClick={() => {
                      setEditingDate(ds)
                      setEditingText(entry?.text ?? '')
                    }}
                    className={`py-2 rounded cursor-pointer hover:ring-2 hover:ring-blue-400 ${hasEntry ? 'bg-blue-500/50 text-white' : 'text-gray-400'}`}
                    title={hasEntry ? `${ds}: ${capitalizeFirst(entry?.text ?? '')}` : `Add entry for ${ds}`}
                  >
                    {d}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Today's prompt */}
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20 mb-6">
            <p className="text-gray-300 mb-4">
              Today: {today ? parseLocalDate(today).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : '…'} (Resets 5am local)
            </p>
            <textarea
              value={todayText}
              onChange={(e) => setTodayText(e.target.value)}
              placeholder="One sentence (or more) about what you learned today"
              className="w-full min-h-[120px] px-4 py-3 rounded-lg bg-white/5 border border-white/20 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Today's entry"
            />
            <div className="mt-4 flex items-center gap-4">
              <button
                onClick={handleSubmit}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors"
              >
                Submit
              </button>
              {saved && <span className="text-green-400">Saved</span>}
            </div>
          </div>

          {/* History */}
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20 mb-6">
            <h2 className="text-2xl font-bold text-white mb-4">History</h2>
            {entries.length === 0 ? (
              <p className="text-gray-300">No entries yet.</p>
            ) : (
              <div className="space-y-3">
                {entries.map((e) => (
                  <div key={e.date} className="bg-white/5 rounded-lg p-4 border border-white/10">
                    <div className="flex items-center justify-between">
                      <div className="text-white font-semibold">{parseLocalDate(e.date).toLocaleDateString()}</div>
                      <button
                        onClick={() => {
                          setEditingDate(e.date)
                          setEditingText(e.text)
                        }}
                        className="text-blue-400 hover:text-blue-300 text-sm"
                      >
                        Edit
                      </button>
                    </div>
                    <div className="text-gray-300 mt-1 whitespace-pre-wrap">{capitalizeFirst(e.text)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {editModal}

          <nav className="flex flex-wrap gap-2">
            {(['analytics', 'export', 'sync'] as const).map((v) => (
              <button
                key={v}
                onClick={() => {
                  setView(v)
                  if (v === 'sync') setSyncKeyInput(getSyncKey())
                }}
                className="px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white hover:bg-white/20 capitalize"
              >
                {v}
              </button>
            ))}
          </nav>
        </div>
      </div>
    )
  }

  if (view === 'analytics') {
    return layout(
      'Analytics',
      <>
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20 mb-6">
          <h2 className="text-2xl font-bold text-white mb-4">Counts</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white/5 rounded-lg p-4 border border-white/10">
              <div className="text-3xl font-bold text-white">{counts.total}</div>
              <div className="text-gray-300">Total entries</div>
            </div>
            <div className="bg-white/5 rounded-lg p-4 border border-white/10">
              <div className="text-3xl font-bold text-white">{counts.thisWeek}</div>
              <div className="text-gray-300">This week</div>
            </div>
            <div className="bg-white/5 rounded-lg p-4 border border-white/10">
              <div className="text-3xl font-bold text-white">{counts.thisMonth}</div>
              <div className="text-gray-300">This month</div>
            </div>
          </div>
        </div>
        <button onClick={() => setView('log')} className="px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white hover:bg-white/20">
          ← Log
        </button>
      </>
    )
  }

  if (view === 'sync') {
    return layout(
      'Sync',
      <>
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20 mb-6">
          <h2 className="text-2xl font-bold text-white mb-4">Restore from Server</h2>
          <p className="text-gray-300 mb-4">
            Lost data after clearing site? Enter your sync key or user ID and click Restore to pull entries from the server.
          </p>
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={restoreKey}
              onChange={(e) => { setRestoreKey(e.target.value); setRestoreResult(null) }}
              placeholder="Sync key or user ID"
              className="flex-1 px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={async () => {
                setRestoring(true)
                setRestoreResult(null)
                const { restored, error } = await restoreFromServer(restoreKey)
                setRestoring(false)
                if (error) setRestoreResult(error)
                else if (restored > 0) {
                  setRestoreResult(`Restored ${restored} entries`)
                  setSyncKeyInput(restoreKey.trim())
                  refresh()
                } else setRestoreResult('No entries found for that key')
              }}
              disabled={restoring || !restoreKey.trim()}
              className="bg-amber-600 hover:bg-amber-700 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg"
            >
              {restoring ? 'Restoring…' : 'Restore'}
            </button>
          </div>
          {restoreResult && (
            <p className={restoreResult.startsWith('Restored') ? 'text-green-400 text-sm' : 'text-amber-400 text-sm'}>
              {restoreResult}
            </p>
          )}
        </div>
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20 mb-6">
          <h2 className="text-2xl font-bold text-white mb-4">Cross-Device Sync</h2>
          <p className="text-gray-300 mb-4">
            Set the same sync key on both devices to merge your history. Sync runs on page load and on every save.
          </p>
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={syncKeyInput}
              onChange={(e) => setSyncKeyInput(e.target.value)}
              placeholder="e.g. jon123"
              className="flex-1 px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={async () => {
                setSyncKey(syncKeyInput.trim())
                setSyncing(true)
                await syncWithServer()
                refresh()
                setSyncing(false)
              }}
              disabled={syncing}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg"
            >
              {syncing ? 'Syncing…' : 'Save & Sync'}
            </button>
          </div>
          {getSyncKey() && (
            <p className="text-green-400 text-sm">Synced. Use this key on your other device.</p>
          )}
        </div>
        <button onClick={() => setView('log')} className="px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white hover:bg-white/20">
          ← Log
        </button>
      </>
    )
  }

  return layout(
    'Export',
    <>
      <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20 mb-6">
        <h2 className="text-2xl font-bold text-white mb-4">Export</h2>
        <p className="text-gray-300 mb-4">Copy as text to paste into ChatGPT or other tools, or download JSON.</p>
        <div className="flex flex-wrap gap-4">
          <button
            onClick={handleCopy}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors"
          >
            Copy as text
          </button>
          <button
            onClick={handleDownload}
            className="bg-white/10 hover:bg-white/20 text-white px-6 py-2 rounded-lg border border-white/20 transition-colors"
          >
            Download JSON
          </button>
        </div>
      </div>
      <button onClick={() => setView('log')} className="px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white hover:bg-white/20">
        ← Log
      </button>
    </>
  )
}
