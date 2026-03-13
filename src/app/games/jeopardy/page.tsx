'use client'

import Image from 'next/image'
import { useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import JeopardyEditor from '@/components/JeopardyEditor'
import JeopardyPlayer from '@/components/JeopardyPlayer'
import type { JeopardyBoard } from '@/lib/jeopardy'
import { readBoardFromFile, createDefaultBoard } from '@/lib/jeopardy'

export default function JeopardyPage() {
  const pathname = usePathname()
  const linePaper = pathname?.startsWith('/notebook')
  const [mode, setMode] = useState<'menu' | 'editor' | 'player'>('menu')
  const [currentBoard, setCurrentBoard] = useState<JeopardyBoard | null>(null)
  const [error, setError] = useState<string | null>(null)
  const editFileRef = useRef<HTMLInputElement>(null)
  const playFileRef = useRef<HTMLInputElement>(null)

  if (mode === 'editor') {
    return (
      <JeopardyEditor 
        onBack={() => setMode('menu')}
        onPlay={(board: JeopardyBoard) => {
          setCurrentBoard(board)
          setMode('player')
        }}
        initialBoard={currentBoard ?? createDefaultBoard()}
      />
    )
  }

  if (mode === 'player') {
    return (
      <JeopardyPlayer 
        board={currentBoard as JeopardyBoard}
        onBack={() => setMode('menu')}
        onEdit={() => setMode('editor')}
      />
    )
  }

  return (
    <div className="flex items-center justify-center p-4">
      {error && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-red-600 text-white px-4 py-2 rounded-lg z-50">
          {error}
        </div>
      )}
      <div className={`rounded-lg p-8 border max-w-md w-full shadow-sm ${linePaper ? 'bg-transparent' : ''}`} style={linePaper ? { borderColor: 'var(--ink-border)' } : { backgroundColor: 'var(--ink-paper)', borderColor: 'var(--ink-border)' }}>
        <h1 className="text-4xl font-bold font-lora text-center mb-8 flex items-center justify-center gap-3" style={{ color: 'var(--ink-text)' }}>
          <Image src={linePaper ? '/doodles/notebook/jeopardy.svg' : '/doodles/jeopardy.svg'} alt="" width={40} height={40} className="h-10 w-10" />
          Jeopardy with Friends
        </h1>
        
        <div className="space-y-4">
          <button
            onClick={() => setMode('editor')}
            className="w-full text-white py-4 px-6 rounded-lg text-xl font-semibold hover:opacity-90"
            style={{ backgroundColor: 'var(--ink-accent)' }}
          >
            Create New Game
          </button>
          
          <div className="grid gap-3">
            <button
              onClick={() => editFileRef.current?.click()}
              className="w-full py-3 px-6 rounded-lg border hover:opacity-90"
              style={{ backgroundColor: 'var(--ink-paper)', borderColor: 'var(--ink-border)', color: 'var(--ink-text)' }}
            >
              Upload JSON to Edit
            </button>
            <input ref={editFileRef} type="file" accept="application/json" className="hidden" onChange={async (e) => {
              const file = e.target.files?.[0]
              if (!file) return
              try {
                const loaded = await readBoardFromFile(file)
                setCurrentBoard(loaded)
                setMode('editor')
                setError(null)
              } catch {
                setError('Failed to parse JSON')
                setTimeout(() => setError(null), 3000)
              } finally {
                e.target.value = ''
              }
            }} />

            <button
              onClick={() => playFileRef.current?.click()}
              className="w-full text-white py-3 px-6 rounded-lg hover:opacity-90"
              style={{ backgroundColor: 'rgb(22 101 52)' }}
            >
              Upload JSON to Play
            </button>
            <input ref={playFileRef} type="file" accept="application/json" className="hidden" onChange={async (e) => {
              const file = e.target.files?.[0]
              if (!file) return
              try {
                const loaded = await readBoardFromFile(file)
                setCurrentBoard(loaded)
                setMode('player')
                setError(null)
              } catch {
                setError('Failed to parse JSON')
                setTimeout(() => setError(null), 3000)
              } finally {
                e.target.value = ''
              }
            }} />
          </div>
          
        </div>
      </div>
    </div>
  )
}
