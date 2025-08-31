'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { JeopardyBoard, JeopardyCategory, JeopardyClue } from '@/lib/jeopardy'
import { createDefaultBoard, downloadBoard, getClueValue, readBoardFromFile, slugify } from '@/lib/jeopardy'

interface JeopardyEditorProps {
  initialBoard?: JeopardyBoard | null
  onBack: () => void
  onPlay: (board: JeopardyBoard) => void
}

export default function JeopardyEditor({ initialBoard, onBack, onPlay }: JeopardyEditorProps) {
  const [board, setBoard] = useState<JeopardyBoard>(() => initialBoard ?? createDefaultBoard())
  const [dragCol, setDragCol] = useState<number | null>(null)
  const [modal, setModal] = useState<{ colIndex: number; rowIndex: number } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [focused, setFocused] = useState<{ colIndex: number; rowIndex: number }>({ colIndex: 0, rowIndex: 0 })

  useEffect(() => {
    if (initialBoard) setBoard(initialBoard)
  }, [initialBoard])

  const rowsCount = useMemo(() => (board.categories[0]?.clues.length ?? 5), [board])

  // Keyboard navigation and open on Enter/Space for the focused cell
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
        setModal({ colIndex: focused.colIndex, rowIndex: focused.rowIndex })
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [board.categories.length, rowsCount, focused, modal])

  function handleAddRow() {
    setBoard((prev) => ({
      ...prev,
      categories: prev.categories.map((cat: JeopardyCategory) => ({
        ...cat,
        clues: [...cat.clues, { question: '', answer: '' }],
      })),
    }))
  }

  function handleRemoveRow() {
    if (rowsCount <= 1) return
    setBoard((prev) => ({
      ...prev,
      categories: prev.categories.map((cat: JeopardyCategory) => ({
        ...cat,
        clues: cat.clues.slice(0, cat.clues.length - 1),
      })),
    }))
  }

  function handleAddColumn() {
    setBoard((prev) => ({
      ...prev,
      categories: [
        ...prev.categories,
        {
          title: `category ${prev.categories.length + 1}`,
          clues: Array.from({ length: rowsCount }, () => ({ question: '', answer: '' })),
        },
      ],
    }))
  }

  function handleRemoveColumn() {
    if (board.categories.length <= 1) return
    setBoard((prev) => ({
      ...prev,
      categories: prev.categories.slice(0, prev.categories.length - 1),
    }))
  }

  function reorderColumns(from: number, to: number) {
    if (from === to || from == null || to == null) return
    setBoard((prev) => {
      if (from < 0 || to < 0 || from >= prev.categories.length || to >= prev.categories.length) return prev
      const next = [...prev.categories]
      const removed = next.splice(from, 1)
      const moved: JeopardyCategory | undefined = removed[0]
      if (!moved) return prev
      next.splice(to, 0, moved)
      return { ...prev, categories: next }
    })
  }

  function updateCategoryTitle(index: number, title: string) {
    setBoard((prev) => {
      const next = [...prev.categories]
      const existing = next[index] as JeopardyCategory
      next[index] = { ...existing, title }
      return { ...prev, categories: next }
    })
  }

  function updateClue(colIndex: number, rowIndex: number, updater: (clue: JeopardyClue) => JeopardyClue) {
    setBoard((prev) => {
      const next = [...prev.categories]
      const cat = next[colIndex] as JeopardyCategory
      const clues = [...cat.clues]
      const current: JeopardyClue = clues[rowIndex] ?? { question: '', answer: '' }
      clues[rowIndex] = updater(current)
      next[colIndex] = { ...cat, clues }
      return { ...prev, categories: next }
    })
  }

  function handleUploadClick() {
    fileInputRef.current?.click()
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const loaded = await readBoardFromFile(file)
      setBoard(loaded)
    } catch {
      alert('Failed to load board JSON')
    } finally {
      e.target.value = ''
    }
  }

  // Ensure an initial hover on mount for new boards
  useEffect(() => {
    setFocused({ colIndex: 0, rowIndex: 0 })
  }, [])

  return (
    <div className="min-h-screen bg-[#142c6d] text-white p-4 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <button onClick={onBack} className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg border border-white/20">← Back</button>
        <div className="flex gap-2 flex-wrap">
          <button onClick={handleAddRow} className="bg-white/10 hover:bg-white/20 px-3 py-2 rounded-lg border border-white/20">+ Add Row</button>
          <button onClick={handleRemoveRow} className="bg-white/10 hover:bg-white/20 px-3 py-2 rounded-lg border border-white/20">Remove Row</button>
          <button onClick={handleAddColumn} className="bg-white/10 hover:bg-white/20 px-3 py-2 rounded-lg border border-white/20">+ Add Column</button>
          <button onClick={handleRemoveColumn} className="bg-white/10 hover:bg-white/20 px-3 py-2 rounded-lg border border-white/20">Remove Column</button>
          <button onClick={() => downloadBoard(board)} className="bg-white/10 hover:bg-white/20 px-3 py-2 rounded-lg border border-white/20">Download JSON</button>
          <button onClick={handleUploadClick} className="bg-white/10 hover:bg-white/20 px-3 py-2 rounded-lg border border-white/20">Upload JSON</button>
          <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={handleFileChange} />
          <button onClick={() => onPlay(board)} className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg">Play ▶</button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto w-full">
        <input
          value={board.title}
          onChange={(e) => setBoard({ ...board, title: e.target.value, id: board.id || slugify(e.target.value) })}
          className="w-full text-center text-2xl sm:text-3xl md:text-4xl font-bold bg-transparent outline-none border-b border-white/20 pb-2 mb-6 wrap-anywhere"
        />

        <div className="smooth-scroll-x">
          <div style={{ minWidth: `${board.categories.length * 90}px` }}>
            <div className="grid" style={{ gridTemplateColumns: `repeat(${board.categories.length}, minmax(0, 1fr))` }}>
              {board.categories.map((cat, colIndex) => (
                <div
                  key={colIndex}
                  className="px-2 py-2 border border-black/30 bg-[#203a88] text-center font-semibold uppercase tracking-wide text-xs sm:text-sm md:text-lg select-none rounded-t-lg"
                  draggable
                  onDragStart={() => setDragCol(colIndex)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    reorderColumns(dragCol as number, colIndex)
                    setDragCol(null)
                  }}
                >
                  <input
                    value={cat.title}
                    onChange={(e) => updateCategoryTitle(colIndex, e.target.value)}
                    className="w-full bg-transparent text-white text-center outline-none wrap-anywhere"
                  />
                </div>
              ))}
            </div>

            {/* Board grid */}
            <div className="grid" style={{ gridTemplateColumns: `repeat(${board.categories.length}, minmax(0, 1fr))` }}>
              {board.categories.map((cat, colIndex) => (
                <div key={colIndex} className="grid" style={{ gridTemplateRows: `repeat(${rowsCount}, minmax(0, 1fr))` }}>
                  {Array.from({ length: rowsCount }, (_, rowIndex) => {
                    const value = getClueValue(board, rowIndex)
                    const clue = cat.clues[rowIndex]
                    const isFocused = focused.colIndex === colIndex && focused.rowIndex === rowIndex
                    return (
                      <button
                        key={rowIndex}
                        onClick={() => { setFocused({ colIndex, rowIndex }); setModal({ colIndex, rowIndex }) }}
                        className={`h-20 sm:h-24 md:h-28 lg:h-32 border border-black/30 text-2xl md:text-3xl font-extrabold text-[#ffda79] flex items-center justify-center select-none rounded-b-lg ${isFocused ? 'bg-[#233a85]' : 'bg-[#1a2f73]'}`}
                      >
                        {clue?.question?.trim() || clue?.answer?.trim() ? (
                          <span className="text-xs sm:text-sm text-white/80 px-2">Edit</span>
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

        <div className="mt-6 text-center text-white/70 text-sm">
          Drag headers to reorder · Arrows navigate · Space/Return open · Tab ↓/wrap → · Esc close · Cmd/Ctrl+Enter save
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <CellModal
          value={getClueValue(board, modal.rowIndex)}
          clue={board.categories[modal.colIndex]?.clues[modal.rowIndex] ?? { question: '', answer: '' }}
          onClose={() => setModal(null)}
          onSave={(clue) => {
            updateClue(modal.colIndex, modal.rowIndex, () => clue)
            setModal(null)
          }}
        />
      )}
    </div>
  )
}

function CellModal({ value, clue, onClose, onSave }: { value: number; clue: JeopardyClue; onClose: () => void; onSave: (clue: JeopardyClue) => void }) {
  const [q, setQ] = useState(clue?.question ?? '')
  const [a, setA] = useState(clue?.answer ?? '')
  const qRef = useRef<HTMLTextAreaElement>(null)
  const qaRef = useRef<{ q: string; a: string }>({ q, a })

  // Keep latest values for the key handler without re-binding the listener
  useEffect(() => {
    qaRef.current = { q, a }
  }, [q, a])

  // Focus question textarea on open only
  useEffect(() => {
    qRef.current?.focus()
    const el = qRef.current
    if (el) {
      const len = el.value.length
      el.setSelectionRange(len, len)
    }
  }, [])

  // Global hotkeys for close and save (does not alter focus)
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
      <div className="bg-[#0f2666] text-white w-full max-w-3xl rounded-2xl border border-white/20">
        <div className="p-4 flex items-center justify-between border-b border-white/10">
          <div className="font-semibold">Edit Clue • Value ${value}</div>
          <button onClick={onClose} className="bg-white/10 hover:bg-white/20 px-3 py-1 rounded-lg">ESC</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
          <div>
            <label className="text-sm text-white/70">Question Prompt</label>
            <textarea ref={qRef} value={q} onChange={(e) => setQ(e.target.value)} className="mt-1 w-full h-40 bg-[#152c70] border border-white/10 rounded-lg p-3 outline-none" />
          </div>
          <div>
            <label className="text-sm text-white/70">Correct Response</label>
            <textarea value={a} onChange={(e) => setA(e.target.value)} className="mt-1 w-full h-40 bg-[#152c70] border border-white/10 rounded-lg p-3 outline-none" />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t border-white/10">
          <button onClick={() => onSave({ question: q, answer: a })} className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg">Continue</button>
        </div>
      </div>
    </div>
  )
}


