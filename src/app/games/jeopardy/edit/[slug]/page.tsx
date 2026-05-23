'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import JeopardyEditor from '@/components/JeopardyEditor'
import NamePrompt from '@/components/JeopardyNamePrompt'
import { useCollabBoard } from '@/lib/jeopardy-collab'
import { getOrCreateIdentity, pushRecent, setEditorName, type EditorIdentity } from '@/lib/jeopardy-identity'

export default function JeopardyEditPage() {
  const params = useParams<{ slug: string }>()
  const router = useRouter()
  const slug = params?.slug || ''

  const [identity, setIdentity] = useState<EditorIdentity | null>(null)
  const [showNamePrompt, setShowNamePrompt] = useState(false)

  useEffect(() => {
    const ident = getOrCreateIdentity()
    setIdentity(ident)
    if (!ident.name) setShowNamePrompt(true)
  }, [])

  const collab = useCollabBoard(slug, identity)

  useEffect(() => {
    if (collab.board?.title && slug) pushRecent(slug, collab.board.title)
  }, [collab.board?.title, slug])

  if (!identity) return null

  if (collab.notFound) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--ink-text)' }}>Board not found</h2>
        <p className="mb-6" style={{ color: 'var(--ink-muted)' }}>The link may be expired or mistyped.</p>
        <button onClick={() => router.push('/games/jeopardy')} className="px-4 py-2 rounded-lg border" style={{ backgroundColor: 'var(--ink-paper)', borderColor: 'var(--ink-border)', color: 'var(--ink-text)' }}>Back to menu</button>
      </div>
    )
  }

  if (collab.loading || !collab.board) {
    return (
      <div className="p-8 text-center" style={{ color: 'var(--ink-muted)' }}>Loading board…</div>
    )
  }

  return (
    <>
      {showNamePrompt && (
        <NamePrompt
          initial={identity.name}
          onSubmit={(name) => {
            setEditorName(name)
            setIdentity((prev) => (prev ? { ...prev, name } : prev))
            setShowNamePrompt(false)
          }}
          onSkip={() => {
            setEditorName('Anonymous')
            setIdentity((prev) => (prev ? { ...prev, name: 'Anonymous' } : prev))
            setShowNamePrompt(false)
          }}
        />
      )}
      <JeopardyEditor
        board={collab.board}
        sendOp={collab.sendOp}
        onBack={() => router.push('/games/jeopardy')}
        onPlay={() => router.push(`/games/jeopardy/play/${slug}`)}
        saveStatus={collab.saveStatus}
        updatedAt={collab.updatedAt}
        lastEditor={collab.lastEditor}
        collaborators={collab.collaborators}
        locks={collab.locks}
        setLock={collab.setLock}
        identityName={identity.name}
        shareUrl={typeof window !== 'undefined' ? window.location.href : ''}
        onChangeName={() => setShowNamePrompt(true)}
      />
    </>
  )
}
