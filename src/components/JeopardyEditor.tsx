'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { JeopardyBoard, JeopardyClue } from '@/lib/jeopardy'
import { downloadBoard, getClueValue } from '@/lib/jeopardy'
import type { JeopardyOp } from '@/lib/jeopardy-ops'
import type { Collaborator, Lock, LockKey, SaveStatus } from '@/lib/jeopardy-collab'
import { initialsFrom } from '@/lib/jeopardy-identity'

interface JeopardyEditorProps {
  board: JeopardyBoard
  sendOp: (op: JeopardyOp) => void
  onBack?: () => void
  onPlay?: () => void
  saveStatus?: SaveStatus
  updatedAt?: string | null
  lastEditor?: string
  collaborators?: Collaborator[]
  locks?: Record<LockKey, Lock>
  setLock?: (key: LockKey | null) => void
  identityName?: string
  shareUrl?: string
  onChangeName?: () => void
}

const lockKeyForCell = (col: number, row: number): LockKey => `clue:${col}:${row}`

export default function JeopardyEditor({
  board,
  sendOp,
  onBack,
  onPlay,
  saveStatus = 'idle',
  updatedAt,
  lastEditor,
  collaborators = [],
  locks = {},
  setLock,
  identityName,
  shareUrl,
  onChangeName,
}: JeopardyEditorProps) {
  const [dragCol, setDragCol] = useState<number | null>(null)
  const [modal, setModal] = useState<{ colIndex: number; rowIndex: number } | null>(null)
  const [focused, setFocused] = useState<{ colIndex: number; rowIndex: number }>({ colIndex: 0, rowIndex: 0 })
  const [shareToast, setShareToast] = useState<string | null>(null)
  const [, forceLabelTick] = useState(0)
  // Refresh "Saved Nm ago" label every 30s so it stays current without DB churn.
  useEffect(() => {
    const id = setInterval(() => forceLabelTick((n) => (n + 1) % 1_000_000), 30_000)
    return () => clearInterval(id)
  }, [])

  // Local mirror values for inputs the user may be actively typing into.
  // We keep them controlled-locally so remote updates don't clobber the caret.
  const [titleDraft, setTitleDraft] = useState(board.title)
  const titleFocusedRef = useRef(false)
  useEffect(() => {
    if (!titleFocusedRef.current) setTitleDraft(board.title)
  }, [board.title])

  const [catDrafts, setCatDrafts] = useState<string[]>(() => board.categories.map((c) => c.title))
  const catFocusedRef = useRef<Set<number>>(new Set())
  useEffect(() => {
    setCatDrafts((prev) => {
      const next = board.categories.map((c, i) =>
        catFocusedRef.current.has(i) && prev[i] !== undefined ? prev[i]! : c.title,
      )
      return next
    })
  }, [board.categories])

  const rowsCount = useMemo(() => board.categories[0]?.clues.length ?? 5, [board])

  // Keyboard navigation (no inputs/textareas).
  useEffect(() => {
    if (modal) return
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      if (target && (target.closest('input') || target.closest('textarea'))) return
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        setFocused((p) => ({ colIndex: Math.max(0, p.colIndex - 1), rowIndex: p.rowIndex }))
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        setFocused((p) => ({ colIndex: Math.min(board.categories.length - 1, p.colIndex + 1), rowIndex: p.rowIndex }))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setFocused((p) => ({ colIndex: p.colIndex, rowIndex: Math.max(0, p.rowIndex - 1) }))
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setFocused((p) => ({ colIndex: p.colIndex, rowIndex: Math.min(rowsCount - 1, p.rowIndex + 1) }))
      } else if (e.key === 'Tab') {
        e.preventDefault()
        setFocused((p) => {
          const nextRow = p.rowIndex < rowsCount - 1 ? p.rowIndex + 1 : 0
          const nextCol = p.rowIndex < rowsCount - 1 ? p.colIndex : (p.colIndex + 1) % board.categories.length
          return { colIndex: nextCol, rowIndex: nextRow }
        })
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        openCell(focused.colIndex, focused.rowIndex)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board.categories.length, rowsCount, focused, modal])

  const reorderColumns = useCallback(
    (from: number, to: number) => {
      if (from === to || from < 0 || to < 0) return
      sendOp({ kind: 'reorderCols', from, to })
    },
    [sendOp],
  )

  const openCell = useCallback(
    (colIndex: number, rowIndex: number) => {
      if (modal) return // already editing a cell — guard against losing unsaved work
      const key = lockKeyForCell(colIndex, rowIndex)
      if (locks[key]) return // someone else editing — block open
      setFocused({ colIndex, rowIndex })
      setModal({ colIndex, rowIndex })
      setLock?.(key)
    },
    [modal, locks, setLock],
  )

  const closeCell = useCallback(() => {
    setModal(null)
    setLock?.(null)
  }, [setLock])

  const saveCell = useCallback(
    (colIndex: number, rowIndex: number, clue: JeopardyClue) => {
      sendOp({ kind: 'setClue', col: colIndex, row: rowIndex, question: clue.question, answer: clue.answer })
      closeCell()
    },
    [sendOp, closeCell],
  )

  const handleShare = useCallback(async () => {
    const url = shareUrl || (typeof window !== 'undefined' ? window.location.href : '')
    if (!url) return
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(url)
        setShareToast('Link copied — share with friends')
      } else {
        setShareToast(url)
      }
    } catch {
      setShareToast(url)
    }
    setTimeout(() => setShareToast(null), 2400)
  }, [shareUrl])

  useEffect(() => {
    setFocused({ colIndex: 0, rowIndex: 0 })
  }, [])

  const savedLabel = useMemo(() => {
    if (saveStatus === 'saving') return 'Saving…'
    if (saveStatus === 'error') return 'Save error'
    if (saveStatus === 'offline') return 'Offline'
    if (saveStatus === 'saved') return 'Saved'
    if (updatedAt) {
      const t = new Date(updatedAt).getTime()
      const diff = Date.now() - t
      if (diff < 60_000) return 'Saved just now'
      if (diff < 3_600_000) return `Saved ${Math.round(diff / 60_000)}m ago`
      return `Saved ${new Date(updatedAt).toLocaleString()}`
    }
    return ''
  }, [saveStatus, updatedAt])

  return (
    <div className="p-4 flex flex-col">
      {shareToast && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded-lg shadow-lg z-50 text-white" style={{ backgroundColor: 'rgb(22 101 52)' }}>
          {shareToast}
        </div>
      )}

      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2">
          {onBack && (
            <button onClick={onBack} className="px-4 py-2 rounded-lg border hover:opacity-90" style={{ backgroundColor: 'var(--ink-paper)', borderColor: 'var(--ink-border)', color: 'var(--ink-text)' }}>← Back</button>
          )}
          <div className="text-xs sm:text-sm" style={{ color: 'var(--ink-muted)' }}>
            <span aria-live="polite">{savedLabel}</span>
            {lastEditor ? <span className="ml-2 hidden sm:inline">· last by {lastEditor}</span> : null}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <CollaboratorChips collaborators={collaborators} selfName={identityName} onRenameSelf={onChangeName} />
        </div>

        <div className="flex gap-2 flex-wrap items-center">
          <div className="inline-flex rounded-lg border overflow-hidden" style={{ borderColor: 'var(--ink-border)' }}>
            <button onClick={() => sendOp({ kind: 'addRow' })} className="px-3 py-2 hover:opacity-90" style={{ backgroundColor: 'var(--ink-paper)', color: 'var(--ink-text)' }} title="Add row">+ Row</button>
            <button onClick={() => {
              if (rowsCount <= 1) return
              if (!window.confirm('Remove the bottom row for everyone? This deletes the highest-value clues.')) return
              sendOp({ kind: 'removeRow' })
            }} className="px-3 py-2 border-l hover:opacity-90" style={{ backgroundColor: 'var(--ink-paper)', borderColor: 'var(--ink-border)', color: 'var(--ink-text)' }} title="Remove bottom row">− Row</button>
          </div>
          <div className="inline-flex rounded-lg border overflow-hidden" style={{ borderColor: 'var(--ink-border)' }}>
            <button onClick={() => sendOp({ kind: 'addCol' })} className="px-3 py-2 hover:opacity-90" style={{ backgroundColor: 'var(--ink-paper)', color: 'var(--ink-text)' }} title="Add category column">+ Col</button>
            <button onClick={() => {
              if (board.categories.length <= 1) return
              if (!window.confirm('Remove the last category for everyone? Its clues will be lost.')) return
              sendOp({ kind: 'removeCol' })
            }} className="px-3 py-2 border-l hover:opacity-90" style={{ backgroundColor: 'var(--ink-paper)', borderColor: 'var(--ink-border)', color: 'var(--ink-text)' }} title="Remove last category">− Col</button>
          </div>
          <button onClick={() => downloadBoard(board)} className="px-3 py-2 rounded-lg border hover:opacity-90" style={{ backgroundColor: 'var(--ink-paper)', borderColor: 'var(--ink-border)', color: 'var(--ink-text)' }} title="Download JSON backup">⬇ JSON</button>
          <button onClick={handleShare} className="px-3 py-2 rounded-lg border hover:opacity-90" style={{ backgroundColor: 'var(--ink-paper)', borderColor: 'var(--ink-border)', color: 'var(--ink-text)' }} title="Copy shareable link">🔗 Share</button>
          {onPlay && (
            <button onClick={onPlay} className="text-white px-4 py-2 rounded-lg hover:opacity-90" style={{ backgroundColor: 'rgb(22 101 52)' }}>Play ▶</button>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto w-full">
        <input
          value={titleDraft}
          maxLength={120}
          onFocus={() => { titleFocusedRef.current = true }}
          onBlur={() => {
            titleFocusedRef.current = false
            if (titleDraft !== board.title) sendOp({ kind: 'setBoardTitle', title: titleDraft })
          }}
          onChange={(e) => setTitleDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur()
          }}
          className="w-full text-center text-2xl sm:text-3xl md:text-4xl font-bold bg-transparent outline-none border-b pb-2 mb-6 wrap-anywhere"
          style={{ borderColor: 'var(--ink-border)', color: 'var(--ink-text)' }}
        />

        <div className="smooth-scroll-x">
          <div style={{ minWidth: `${board.categories.length * 90}px` }}>
            <div className="grid" style={{ gridTemplateColumns: `repeat(${board.categories.length}, minmax(0, 1fr))` }}>
              {board.categories.map((cat, colIndex) => (
                <div
                  key={colIndex}
                  className="px-2 py-2 border text-center font-semibold uppercase tracking-wide text-xs sm:text-sm md:text-lg select-none rounded-t-lg"
                  style={{ borderColor: 'var(--ink-border)', backgroundColor: 'var(--ink-paper)', color: 'var(--ink-text)' }}
                  draggable
                  onDragStart={() => setDragCol(colIndex)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    reorderColumns(dragCol as number, colIndex)
                    setDragCol(null)
                  }}
                >
                  <input
                    value={catDrafts[colIndex] ?? cat.title}
                    maxLength={80}
                    onFocus={() => catFocusedRef.current.add(colIndex)}
                    onBlur={() => {
                      catFocusedRef.current.delete(colIndex)
                      const v = catDrafts[colIndex] ?? cat.title
                      if (v !== cat.title) sendOp({ kind: 'setCategoryTitle', col: colIndex, title: v })
                    }}
                    onChange={(e) => setCatDrafts((prev) => {
                      const next = [...prev]
                      next[colIndex] = e.target.value
                      return next
                    })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur()
                    }}
                    className="w-full bg-transparent text-center outline-none wrap-anywhere"
                    style={{ color: 'var(--ink-text)' }}
                  />
                </div>
              ))}
            </div>

            <div className="grid" style={{ gridTemplateColumns: `repeat(${board.categories.length}, minmax(0, 1fr))` }}>
              {board.categories.map((cat, colIndex) => (
                <div key={colIndex} className="grid" style={{ gridTemplateRows: `repeat(${rowsCount}, minmax(0, 1fr))` }}>
                  {Array.from({ length: rowsCount }, (_, rowIndex) => {
                    const value = getClueValue(board, rowIndex)
                    const clue = cat.clues[rowIndex]
                    const isFocused = focused.colIndex === colIndex && focused.rowIndex === rowIndex
                    const lock = locks[lockKeyForCell(colIndex, rowIndex)]
                    const filled = !!(clue?.question?.trim() || clue?.answer?.trim())
                    return (
                      <button
                        key={rowIndex}
                        onClick={() => openCell(colIndex, rowIndex)}
                        disabled={!!lock}
                        className="relative h-20 sm:h-24 md:h-28 lg:h-32 border text-2xl md:text-3xl font-extrabold flex items-center justify-center select-none rounded-b-lg disabled:cursor-not-allowed"
                        style={{
                          borderColor: lock ? lock.color : 'var(--ink-border)',
                          backgroundColor: isFocused && !lock ? 'var(--ink-accent)' : 'var(--ink-paper)',
                          color: isFocused && !lock ? 'white' : 'var(--ink-text)',
                          boxShadow: lock ? `inset 0 0 0 2px ${lock.color}` : undefined,
                          opacity: lock ? 0.7 : 1,
                        }}
                        title={lock ? `${lock.name} is editing` : undefined}
                      >
                        {lock ? (
                          <span className="flex flex-col items-center gap-1">
                            <Avatar color={lock.color} name={lock.name} small />
                            <span className="text-xs font-normal" style={{ color: 'var(--ink-muted)' }}>editing</span>
                          </span>
                        ) : filled ? (
                          <span className="text-xs sm:text-sm px-2" style={{ color: isFocused ? 'rgba(255,255,255,0.85)' : 'var(--ink-muted)' }}>Edit · ${value}</span>
                        ) : (
                          <span>${value}</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 text-center text-sm" style={{ color: 'var(--ink-muted)' }}>
          Drag headers to reorder · Arrows navigate · Space/Return open · Esc close · Cmd/Ctrl+Enter save
        </div>
      </div>

      {modal && (
        <CellModal
          key={`${modal.colIndex}:${modal.rowIndex}`}
          value={getClueValue(board, modal.rowIndex)}
          categoryTitle={board.categories[modal.colIndex]?.title ?? ''}
          clue={board.categories[modal.colIndex]?.clues[modal.rowIndex] ?? { question: '', answer: '' }}
          onClose={closeCell}
          onSave={(clue) => saveCell(modal.colIndex, modal.rowIndex, clue)}
        />
      )}
    </div>
  )
}

function CollaboratorChips({
  collaborators,
  selfName,
  onRenameSelf,
}: {
  collaborators: Collaborator[]
  selfName?: string | undefined
  onRenameSelf?: (() => void) | undefined
}) {
  if (!collaborators.length) return null
  const sorted = [...collaborators].sort((a, b) => a.online_at.localeCompare(b.online_at))
  return (
    <div className="flex items-center -space-x-2">
      {sorted.slice(0, 6).map((c) => {
        const isSelf = c.name === selfName
        const baseStyle = { width: 28, height: 28, backgroundColor: c.color, borderColor: 'var(--ink-paper)' } as const
        const tooltip = `${c.name}${isSelf ? ' (you) · click to rename' : ''}`
        const initials = initialsFrom(c.name)
        if (isSelf && onRenameSelf) {
          return (
            <button
              key={c.id}
              onClick={onRenameSelf}
              className="rounded-full flex items-center justify-center text-xs font-bold text-white border-2 cursor-pointer hover:scale-110 transition-transform"
              style={baseStyle}
              title={tooltip}
            >
              {initials}
            </button>
          )
        }
        return (
          <div
            key={c.id}
            className="rounded-full flex items-center justify-center text-xs font-bold text-white border-2"
            style={baseStyle}
            title={tooltip}
          >
            {initials}
          </div>
        )
      })}
      {sorted.length > 6 && (
        <div className="text-xs ml-3" style={{ color: 'var(--ink-muted)' }}>+{sorted.length - 6}</div>
      )}
    </div>
  )
}

function Avatar({ color, name, small }: { color: string; name: string; small?: boolean }) {
  const size = small ? 20 : 28
  return (
    <span
      className="inline-flex items-center justify-center rounded-full text-white font-bold"
      style={{ width: size, height: size, backgroundColor: color, fontSize: small ? 10 : 12 }}
    >
      {initialsFrom(name)}
    </span>
  )
}

function CellModal({
  value,
  categoryTitle,
  clue,
  onClose,
  onSave,
}: {
  value: number
  categoryTitle: string
  clue: JeopardyClue
  onClose: () => void
  onSave: (clue: JeopardyClue) => void
}) {
  const [q, setQ] = useState(clue?.question ?? '')
  const [a, setA] = useState(clue?.answer ?? '')
  const qRef = useRef<HTMLTextAreaElement>(null)
  const qaRef = useRef<{ q: string; a: string }>({ q, a })

  useEffect(() => { qaRef.current = { q, a } }, [q, a])

  useEffect(() => {
    qRef.current?.focus()
    const el = qRef.current
    if (el) {
      const len = el.value.length
      el.setSelectionRange(len, len)
    }
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        const { q: qLatest, a: aLatest } = qaRef.current
        onSave({ question: qLatest, answer: aLatest })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, onSave])

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="w-full max-w-3xl rounded-lg border shadow-lg" style={{ backgroundColor: 'var(--ink-paper)', borderColor: 'var(--ink-border)' }}>
        <div className="p-4 flex items-center justify-between border-b" style={{ borderColor: 'var(--ink-border)' }}>
          <div className="font-semibold truncate" style={{ color: 'var(--ink-text)' }}>{categoryTitle || 'Clue'} • ${value}</div>
          <button onClick={onClose} className="px-3 py-1 rounded-lg hover:opacity-90" style={{ backgroundColor: 'var(--ink-bg)', borderColor: 'var(--ink-border)', color: 'var(--ink-text)' }}>ESC</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
          <div>
            <label className="text-sm" style={{ color: 'var(--ink-muted)' }}>Question Prompt</label>
            <textarea ref={qRef} value={q} onChange={(e) => setQ(e.target.value)} className="mt-1 w-full h-40 rounded-lg p-3 outline-none border focus:ring-2 focus:ring-(--ink-accent)" style={{ backgroundColor: 'var(--ink-bg)', borderColor: 'var(--ink-border)', color: 'var(--ink-text)' }} />
          </div>
          <div>
            <label className="text-sm" style={{ color: 'var(--ink-muted)' }}>Correct Response</label>
            <textarea value={a} onChange={(e) => setA(e.target.value)} className="mt-1 w-full h-40 rounded-lg p-3 outline-none border focus:ring-2 focus:ring-(--ink-accent)" style={{ backgroundColor: 'var(--ink-bg)', borderColor: 'var(--ink-border)', color: 'var(--ink-text)' }} />
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 p-4 border-t" style={{ borderColor: 'var(--ink-border)' }}>
          <span className="text-xs" style={{ color: 'var(--ink-muted)' }}>Cmd/Ctrl+Enter to save</span>
          <button onClick={() => onSave({ question: q, answer: a })} className="text-white px-4 py-2 rounded-lg hover:opacity-90" style={{ backgroundColor: 'rgb(22 101 52)' }}>Save</button>
        </div>
      </div>
    </div>
  )
}
