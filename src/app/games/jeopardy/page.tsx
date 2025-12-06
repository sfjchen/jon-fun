'use client'

import { useRef, useState } from 'react'
import JeopardyEditor from '@/components/JeopardyEditor'
import JeopardyPlayer from '@/components/JeopardyPlayer'
import type { JeopardyBoard } from '@/lib/jeopardy'
import { readBoardFromFile, createDefaultBoard } from '@/lib/jeopardy'

export default function JeopardyPage() {
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
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 flex items-center justify-center p-4">
      {error && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-red-600 text-white px-4 py-2 rounded-lg z-50">
          {error}
        </div>
      )}
      <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20 max-w-md w-full">
        <h1 className="text-4xl font-bold text-white text-center mb-8">❓ Jeopardy with Friends</h1>
        
        <div className="space-y-4">
          <button
            onClick={() => setMode('editor')}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 px-6 rounded-lg text-xl font-semibold transition-colors"
          >
            Create New Game
          </button>
          
          <div className="grid gap-3">
            <button
              onClick={() => editFileRef.current?.click()}
              className="w-full bg-white/10 hover:bg-white/20 text-white py-3 px-6 rounded-lg border border-white/20"
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
              className="w-full bg-green-600 hover:bg-green-700 text-white py-3 px-6 rounded-lg"
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
          
          <button
            onClick={() => window.history.back()}
            className="w-full bg-gray-600 hover:bg-gray-700 text-white py-4 px-6 rounded-lg text-xl font-semibold transition-colors"
          >
            Back to Games
          </button>
        </div>
      </div>
    </div>
  )
}
