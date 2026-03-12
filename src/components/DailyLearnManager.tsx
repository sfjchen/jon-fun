'use client'

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
  const [saving, setSaving] = useState(false)
  const [syncFailed, setSyncFailed] = useState(false)

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
    if (view !== 'log') return
    const id = setInterval(() => {
      syncWithServer().then(() => {
        refresh()
        setSyncFailed(false)
      })
    }, 60_000)
    return () => clearInterval(id)
  }, [refresh, view])

  useEffect(() => {
    const d = getTodayDate()
    setTodayText(getEntryByDate(d)?.text ?? '')
  }, [view, entries])

  const handleSubmit = useCallback(async () => {
    const date = getTodayDate()
    setSaving(true)
    setSyncFailed(false)
    const ok = await saveEntry({ date, text: todayText.trim() })
    setSaving(false)
    setSaved(ok)
    setSyncFailed(!ok)
    refresh()
    if (ok) setTimeout(() => setSaved(false), 2000)
  }, [todayText, refresh])

  const handleSaveEdit = useCallback(async () => {
    if (!editingDate) return
    setSaving(true)
    setSyncFailed(false)
    const ok = await saveEntry({ date: editingDate, text: editingText.trim() })
    setSaving(false)
    if (ok) {
      setEditingDate(null)
      setEditingText('')
    } else setSyncFailed(true)
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
    <div className="max-w-4xl mx-auto">
      <h1 className="text-4xl font-bold font-lora mb-8" style={{ color: 'var(--ink-text)' }}>{title}</h1>
      {children}
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
      <div className="rounded-lg p-6 border max-w-lg w-full shadow-lg" style={{ backgroundColor: 'var(--ink-paper)', borderColor: 'var(--ink-border)' }}>
        <h3 className="text-xl font-bold font-lora mb-2" style={{ color: 'var(--ink-text)' }}>Edit {parseLocalDate(editingDate).toLocaleDateString()}</h3>
        <textarea
          value={editingText}
          onChange={(e) => setEditingText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && e.metaKey) { e.preventDefault(); handleSaveEdit() }
            if (e.key === 'Escape') { e.preventDefault(); setEditingDate(null); setEditingText('') }
          }}
          className="w-full min-h-[100px] px-4 py-3 rounded-lg border focus:outline-none focus:ring-2 focus:ring-[var(--ink-accent)]"
          style={{ backgroundColor: 'var(--ink-bg)', borderColor: 'var(--ink-border)', color: 'var(--ink-text)' }}
          autoFocus
        />
        <div className="mt-4 flex gap-2">
          <button onClick={handleSaveEdit} disabled={saving} className="text-white px-4 py-2 rounded-lg hover:opacity-90 disabled:opacity-60" style={{ backgroundColor: 'var(--ink-accent)' }}>
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button onClick={() => { setEditingDate(null); setEditingText('') }} className="px-4 py-2 rounded-lg border hover:opacity-90" style={{ backgroundColor: 'var(--ink-paper)', borderColor: 'var(--ink-border)', color: 'var(--ink-text)' }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )

  if (view === 'log') {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-4xl font-bold font-lora" style={{ color: 'var(--ink-text)' }}>1 Sentence Everyday</h1>
          {syncing && <span className="text-sm" style={{ color: 'var(--ink-muted)' }}>Syncing…</span>}
        </div>

        {entries.length === 0 && (
          <div className="rounded-lg p-4 mb-6 border" style={{ backgroundColor: 'var(--ink-paper)', borderColor: 'var(--ink-border)' }}>
            <p className="font-medium" style={{ color: 'var(--ink-text)' }}>Restore your logs</p>
            <p className="text-sm mt-1" style={{ color: 'var(--ink-muted)' }}>
              Go to <button type="button" onClick={() => setView('sync')} className="underline" style={{ color: 'var(--ink-accent)' }}>Sync</button> tab → enter your sync key → Restore. Do this on each device.
            </p>
          </div>
        )}
        {/* Calendar */}
        <div className="rounded-lg p-6 border mb-6 shadow-sm" style={{ backgroundColor: 'var(--ink-paper)', borderColor: 'var(--ink-border)' }}>
            <div className="flex items-center justify-between mb-4">
              <button
                type="button"
                onClick={() => {
                  if (month === 0) { setCalMonth(11); setCalYear((y) => y - 1) }
                  else setCalMonth((m) => m - 1)
                }}
                className="min-h-11 min-w-11 px-4 py-2 hover:opacity-80 flex items-center justify-center"
                style={{ color: 'var(--ink-text)' }}
              >
                ←
              </button>
              <h2 className="text-2xl font-bold font-lora" style={{ color: 'var(--ink-text)' }}>
                {new Date(year, month).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
              </h2>
              <button
                type="button"
                onClick={() => {
                  if (month === 11) { setCalMonth(0); setCalYear((y) => y + 1) }
                  else setCalMonth((m) => m + 1)
                }}
                className="min-h-11 min-w-11 px-4 py-2 hover:opacity-80 flex items-center justify-center"
                style={{ color: 'var(--ink-text)' }}
              >
                →
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                <div key={d} className="text-sm font-medium py-1" style={{ color: 'var(--ink-muted)' }}>
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
                    className="py-2 rounded cursor-pointer hover:ring-2 hover:ring-[var(--ink-accent)] transition-colors"
                    style={hasEntry ? { backgroundColor: 'var(--ink-accent)', color: 'white' } : { color: 'var(--ink-muted)' }}
                    title={hasEntry ? `${ds}: ${capitalizeFirst(entry?.text ?? '')}` : `Add entry for ${ds}`}
                  >
                    {d}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Today's prompt */}
          <div className="rounded-lg p-6 border mb-6 shadow-sm" style={{ backgroundColor: 'var(--ink-paper)', borderColor: 'var(--ink-border)' }}>
            <p className="mb-4" style={{ color: 'var(--ink-muted)' }}>
              Today: {today ? parseLocalDate(today).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : '…'} (Resets 5am local)
            </p>
            <textarea
              value={todayText}
              onChange={(e) => setTodayText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.metaKey) { e.preventDefault(); handleSubmit() }
                if (e.key === 'Escape') { e.preventDefault(); (e.target as HTMLTextAreaElement).blur() }
              }}
              placeholder="One sentence (or more) about what you learned today"
              className="w-full min-h-[120px] px-4 py-3 rounded-lg border focus:outline-none focus:ring-2 focus:ring-[var(--ink-accent)]"
              style={{ backgroundColor: 'var(--ink-bg)', borderColor: 'var(--ink-border)', color: 'var(--ink-text)' }}
              aria-label="Today's entry"
            />
            <div className="mt-4 flex items-center gap-4">
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="text-white px-6 py-2 rounded-lg transition-colors hover:opacity-90 disabled:opacity-60"
                style={{ backgroundColor: 'var(--ink-accent)' }}
              >
                {saving ? 'Saving…' : 'Submit'}
              </button>
              {saved && <span className="text-green-600">Saved</span>}
              {syncFailed && <span className="text-amber-600">Sync failed – saved locally, will retry</span>}
            </div>
          </div>

          {/* History */}
          <div className="rounded-lg p-6 border mb-6 shadow-sm" style={{ backgroundColor: 'var(--ink-paper)', borderColor: 'var(--ink-border)' }}>
            <h2 className="text-2xl font-bold font-lora mb-4" style={{ color: 'var(--ink-text)' }}>History</h2>
            {entries.length === 0 ? (
              <p style={{ color: 'var(--ink-muted)' }}>No entries yet.</p>
            ) : (
              <div className="space-y-3">
                {entries.map((e) => (
                  <div key={e.date} className="rounded-lg p-4 border" style={{ backgroundColor: 'var(--ink-bg)', borderColor: 'var(--ink-border)' }}>
                    <div className="flex items-center justify-between">
                      <div className="font-semibold" style={{ color: 'var(--ink-text)' }}>{parseLocalDate(e.date).toLocaleDateString()}</div>
                      <button
                        onClick={() => {
                          setEditingDate(e.date)
                          setEditingText(e.text)
                        }}
                        className="text-sm hover:opacity-80"
                        style={{ color: 'var(--ink-accent)' }}
                      >
                        Edit
                      </button>
                    </div>
                    <div className="mt-1 whitespace-pre-wrap" style={{ color: 'var(--ink-muted)' }}>{capitalizeFirst(e.text)}</div>
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
                className="px-4 py-2 rounded-lg border capitalize hover:opacity-90 transition-colors"
                style={{ backgroundColor: 'var(--ink-paper)', borderColor: 'var(--ink-border)', color: 'var(--ink-text)' }}
              >
                {v}
              </button>
            ))}
          </nav>
        </div>
    )
  }

  if (view === 'analytics') {
    return layout(
      'Analytics',
      <>
        <div className="rounded-lg p-6 border mb-6 shadow-sm" style={{ backgroundColor: 'var(--ink-paper)', borderColor: 'var(--ink-border)' }}>
          <h2 className="text-2xl font-bold font-lora mb-4" style={{ color: 'var(--ink-text)' }}>Counts</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-lg p-4 border" style={{ backgroundColor: 'var(--ink-bg)', borderColor: 'var(--ink-border)' }}>
              <div className="text-3xl font-bold" style={{ color: 'var(--ink-text)' }}>{counts.total}</div>
              <div style={{ color: 'var(--ink-muted)' }}>Total entries</div>
            </div>
            <div className="rounded-lg p-4 border" style={{ backgroundColor: 'var(--ink-bg)', borderColor: 'var(--ink-border)' }}>
              <div className="text-3xl font-bold" style={{ color: 'var(--ink-text)' }}>{counts.thisWeek}</div>
              <div style={{ color: 'var(--ink-muted)' }}>This week</div>
            </div>
            <div className="rounded-lg p-4 border" style={{ backgroundColor: 'var(--ink-bg)', borderColor: 'var(--ink-border)' }}>
              <div className="text-3xl font-bold" style={{ color: 'var(--ink-text)' }}>{counts.thisMonth}</div>
              <div style={{ color: 'var(--ink-muted)' }}>This month</div>
            </div>
          </div>
        </div>
        <button onClick={() => setView('log')} className="px-4 py-2 rounded-lg border hover:opacity-90" style={{ backgroundColor: 'var(--ink-paper)', borderColor: 'var(--ink-border)', color: 'var(--ink-text)' }}>
          ← Log
        </button>
      </>
    )
  }

  if (view === 'sync') {
    return layout(
      'Sync',
      <>
        <div className="rounded-lg p-6 border mb-6 shadow-sm" style={{ backgroundColor: 'var(--ink-paper)', borderColor: 'var(--ink-border)' }}>
          <h2 className="text-2xl font-bold font-lora mb-4" style={{ color: 'var(--ink-text)' }}>Restore from Server</h2>
          <p className="mb-4" style={{ color: 'var(--ink-muted)' }}>
            Lost data after clearing site? Enter your sync key or user ID and click Restore to pull entries from the server.
          </p>
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={restoreKey}
              onChange={(e) => { setRestoreKey(e.target.value); setRestoreResult(null) }}
              placeholder="Sync key or user ID"
              className="flex-1 px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-[var(--ink-accent)]"
              style={{ backgroundColor: 'var(--ink-bg)', borderColor: 'var(--ink-border)', color: 'var(--ink-text)' }}
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
              className="px-4 py-2 rounded-lg text-white disabled:opacity-50"
              style={{ backgroundColor: 'var(--ink-accent)' }}
            >
              {restoring ? 'Restoring…' : 'Restore'}
            </button>
          </div>
          {restoreResult && (
            <p className={`text-sm ${restoreResult.startsWith('Restored') ? 'text-green-600' : ''}`} style={!restoreResult.startsWith('Restored') ? { color: 'var(--ink-muted)' } : undefined}>
              {restoreResult}
            </p>
          )}
        </div>
        <div className="rounded-lg p-6 border mb-6 shadow-sm" style={{ backgroundColor: 'var(--ink-paper)', borderColor: 'var(--ink-border)' }}>
          <h2 className="text-2xl font-bold font-lora mb-4" style={{ color: 'var(--ink-text)' }}>Cross-Device Sync</h2>
          <p className="mb-4" style={{ color: 'var(--ink-muted)' }}>
            Set the same sync key on both devices to merge your history. Sync runs on page load and on every save.
          </p>
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={syncKeyInput}
              onChange={(e) => setSyncKeyInput(e.target.value)}
              placeholder="e.g. jon123"
              className="flex-1 px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-[var(--ink-accent)]"
              style={{ backgroundColor: 'var(--ink-bg)', borderColor: 'var(--ink-border)', color: 'var(--ink-text)' }}
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
              className="text-white px-4 py-2 rounded-lg disabled:opacity-50"
              style={{ backgroundColor: 'var(--ink-accent)' }}
            >
              {syncing ? 'Syncing…' : 'Save & Sync'}
            </button>
          </div>
          {getSyncKey() && (
            <p className="text-green-600 text-sm">Synced. Use this key on your other device.</p>
          )}
        </div>
        <button onClick={() => setView('log')} className="px-4 py-2 rounded-lg border hover:opacity-90" style={{ backgroundColor: 'var(--ink-paper)', borderColor: 'var(--ink-border)', color: 'var(--ink-text)' }}>
          ← Log
        </button>
      </>
    )
  }

  return layout(
    'Export',
    <>
      <div className="rounded-lg p-6 border mb-6 shadow-sm" style={{ backgroundColor: 'var(--ink-paper)', borderColor: 'var(--ink-border)' }}>
        <h2 className="text-2xl font-bold font-lora mb-4" style={{ color: 'var(--ink-text)' }}>Export</h2>
        <p className="mb-4" style={{ color: 'var(--ink-muted)' }}>Copy as text to paste into ChatGPT or other tools, or download JSON.</p>
        <div className="flex flex-wrap gap-4">
          <button
            onClick={handleCopy}
            className="text-white px-6 py-2 rounded-lg hover:opacity-90"
            style={{ backgroundColor: 'var(--ink-accent)' }}
          >
            Copy as text
          </button>
          <button
            onClick={handleDownload}
            className="px-6 py-2 rounded-lg border hover:opacity-90"
            style={{ backgroundColor: 'var(--ink-paper)', borderColor: 'var(--ink-border)', color: 'var(--ink-text)' }}
          >
            Download JSON
          </button>
        </div>
      </div>
      <button onClick={() => setView('log')} className="px-4 py-2 rounded-lg border hover:opacity-90" style={{ backgroundColor: 'var(--ink-paper)', borderColor: 'var(--ink-border)', color: 'var(--ink-text)' }}>
        ← Log
      </button>
    </>
  )
}
