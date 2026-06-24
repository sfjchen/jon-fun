'use client'

import { useCallback, useState } from 'react'
import type { NoteFolder, NoteSession } from '@/lib/notes/types'
import { childFolders, sessionsInFolder } from '@/lib/notes/folders'

const NOTE_DRAG = 'application/x-notes-session-id'
const FOLDER_DRAG = 'application/x-notes-folder-id'

function formatMeetingDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

type NotesVaultPanelProps = {
  sessions: NoteSession[]
  folders: NoteFolder[]
  activeSessionId: string
  expandedFolderIds: string[]
  onSelectMeeting: (session: NoteSession) => void
  onNewNote: (folderId: string | null) => void
  onNewFolder: (parentId: string | null, name: string) => void
  onDeleteFolder: (folderId: string) => void
  onMoveNote: (sessionId: string, folderId: string | null) => void
  onMoveFolder: (folderId: string, parentId: string | null) => void
  onDeleteMeeting: (sessionId: string) => void
  onToggleFolder: (folderId: string) => void
}

function NoteRow({
  session,
  active,
  onSelect,
  onDelete,
}: {
  session: NoteSession
  active: boolean
  onSelect: () => void
  onDelete: () => void
}) {
  return (
    <li
      className="group flex items-center gap-0.5 pl-4"
      draggable
      data-testid={`notes-note-row-${session.id}`}
      onDragStart={(e) => {
        e.dataTransfer.setData(NOTE_DRAG, session.id)
        e.dataTransfer.effectAllowed = 'move'
      }}
    >
      <button
        type="button"
        data-testid={`notes-meeting-item-${session.id}`}
        data-active={active ? 'true' : 'false'}
        onClick={onSelect}
        className={`flex min-w-0 flex-1 items-center gap-2 rounded px-2 py-0.5 text-left text-xs ${
          active
            ? 'notes-meeting-active text-[var(--uv-text-primary)]'
            : 'text-[var(--uv-text-secondary)] hover:bg-[var(--uv-bg-hover)]'
        }`}
      >
        <span className="min-w-0 flex-1 truncate">{session.title || 'Untitled'}</span>
        <span className="shrink-0 text-[10px] tabular-nums text-[var(--uv-text-muted)]">
          {formatMeetingDate(session.updatedAt)}
        </span>
      </button>
      <button
        type="button"
        aria-label={`Delete ${session.title || 'note'}`}
        data-testid={`notes-delete-meeting-${session.id}`}
        onClick={(e) => {
          e.stopPropagation()
          onDelete()
        }}
        className="shrink-0 rounded px-1 text-[10px] leading-none text-[var(--uv-text-muted)] opacity-0 hover:text-red-600 group-hover:opacity-100"
      >
        ×
      </button>
    </li>
  )
}

function FolderDropHeader({
  folderId,
  dropTestId,
  depth,
  open,
  label,
  count,
  draggableFolderId,
  onToggle,
  onDropNote,
  onDropFolder,
  children,
}: {
  folderId: string | null
  dropTestId: string
  depth: number
  open: boolean
  label: string
  count: number
  draggableFolderId?: string
  onToggle: () => void
  onDropNote: (sessionId: string) => void
  onDropFolder: (folderId: string) => void
  children?: React.ReactNode
}) {
  const [over, setOver] = useState(false)
  const pad = { paddingLeft: `${8 + depth * 10}px` }

  const onDragOver = useCallback((e: React.DragEvent) => {
    const types = e.dataTransfer.types
    if (types.includes(NOTE_DRAG) || types.includes(FOLDER_DRAG)) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      setOver(true)
    }
  }, [])

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setOver(false)
      const noteId = e.dataTransfer.getData(NOTE_DRAG)
      const fldId = e.dataTransfer.getData(FOLDER_DRAG)
      if (noteId) onDropNote(noteId)
      else if (fldId) onDropFolder(fldId)
    },
    [onDropNote, onDropFolder],
  )

  return (
    <div
      className={`group flex items-center gap-0.5 rounded ${over ? 'bg-[var(--uv-accent-dim)] ring-1 ring-[var(--uv-accent)]' : ''}`}
      style={pad}
      data-testid={dropTestId}
      onDragOver={onDragOver}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
    >
      <button
        type="button"
        draggable={Boolean(draggableFolderId)}
        onDragStart={
          draggableFolderId
            ? (e) => {
                e.dataTransfer.setData(FOLDER_DRAG, draggableFolderId)
                e.dataTransfer.effectAllowed = 'move'
                e.stopPropagation()
              }
            : undefined
        }
        onClick={onToggle}
        className="flex min-w-0 flex-1 items-center gap-1 rounded px-1 py-0.5 text-left text-[11px] font-medium text-[var(--uv-text-primary)] hover:bg-[var(--uv-bg-hover)]"
        data-testid={folderId ? `notes-folder-toggle-${folderId}` : 'notes-folder-toggle-__inbox__'}
      >
        <span className="text-[10px] text-[var(--uv-text-muted)]">{open ? '▾' : '▸'}</span>
        <span className="truncate">{label}</span>
        <span className="text-[10px] font-normal text-[var(--uv-text-muted)]">({count})</span>
      </button>
      {children}
    </div>
  )
}

function FolderBranch({
  folder,
  depth,
  sessions,
  folders,
  activeSessionId,
  expandedFolderIds,
  onSelectMeeting,
  onNewNote,
  onOpenNewFolderForm,
  onDeleteFolder,
  onMoveNote,
  onMoveFolder,
  onDeleteMeeting,
  onToggleFolder,
}: {
  folder: NoteFolder
  depth: number
  sessions: NoteSession[]
  folders: NoteFolder[]
  activeSessionId: string
  expandedFolderIds: string[]
  onSelectMeeting: (s: NoteSession) => void
  onNewNote: (folderId: string | null) => void
  onOpenNewFolderForm: (parentId: string | null) => void
  onDeleteFolder: (folderId: string) => void
  onMoveNote: (sessionId: string, folderId: string | null) => void
  onMoveFolder: (folderId: string, parentId: string | null) => void
  onDeleteMeeting: (sessionId: string) => void
  onToggleFolder: (folderId: string) => void
}) {
  const open = expandedFolderIds.includes(folder.id)
  const notes = sessionsInFolder(sessions, folder.id)
  const subfolders = childFolders(folders, folder.id)

  const handleDropNote = useCallback(
    (sessionId: string) => onMoveNote(sessionId, folder.id),
    [folder.id, onMoveNote],
  )

  const handleDropFolder = useCallback(
    (folderId: string) => onMoveFolder(folderId, folder.id),
    [folder.id, onMoveFolder],
  )

  return (
    <li data-testid={`notes-folder-${folder.id}`}>
      <FolderDropHeader
        folderId={folder.id}
        dropTestId={`notes-folder-drop-${folder.id}`}
        depth={depth}
        open={open}
        label={folder.name}
        count={notes.length}
        draggableFolderId={folder.id}
        onToggle={() => onToggleFolder(folder.id)}
        onDropNote={handleDropNote}
        onDropFolder={handleDropFolder}
      >
        <button
          type="button"
          title="New note in folder"
          onClick={() => onNewNote(folder.id)}
          className="shrink-0 rounded px-1 text-[10px] text-[var(--uv-accent)] opacity-0 hover:bg-[var(--uv-accent-dim)] group-hover:opacity-100"
        >
          +
        </button>
        <button
          type="button"
          title="New subfolder"
          onClick={() => onOpenNewFolderForm(folder.id)}
          className="shrink-0 rounded px-1 text-[10px] text-[var(--uv-text-muted)] opacity-0 hover:bg-[var(--uv-bg-hover)] group-hover:opacity-100"
        >
          +↳
        </button>
        <button
          type="button"
          aria-label={`Delete folder ${folder.name}`}
          data-testid={`notes-delete-folder-${folder.id}`}
          onClick={() => onDeleteFolder(folder.id)}
          className="shrink-0 rounded px-1 text-[10px] text-[var(--uv-text-muted)] opacity-0 hover:text-red-600 group-hover:opacity-100"
        >
          ×
        </button>
      </FolderDropHeader>
      {open ? (
        <>
          <ul className="space-y-0">
            {notes.map((s) => (
              <NoteRow
                key={s.id}
                session={s}
                active={s.id === activeSessionId}
                onSelect={() => onSelectMeeting(s)}
                onDelete={() => onDeleteMeeting(s.id)}
              />
            ))}
          </ul>
          {subfolders.map((sub) => (
            <ul key={sub.id}>
              <FolderBranch
                folder={sub}
                depth={depth + 1}
                sessions={sessions}
                folders={folders}
                activeSessionId={activeSessionId}
                expandedFolderIds={expandedFolderIds}
                onSelectMeeting={onSelectMeeting}
                onNewNote={onNewNote}
                onOpenNewFolderForm={onOpenNewFolderForm}
                onDeleteFolder={onDeleteFolder}
                onMoveNote={onMoveNote}
                onMoveFolder={onMoveFolder}
                onDeleteMeeting={onDeleteMeeting}
                onToggleFolder={onToggleFolder}
              />
            </ul>
          ))}
        </>
      ) : null}
    </li>
  )
}

export default function NotesVaultPanel({
  sessions,
  folders,
  activeSessionId,
  expandedFolderIds,
  onSelectMeeting,
  onNewNote,
  onNewFolder,
  onDeleteFolder,
  onMoveNote,
  onMoveFolder,
  onDeleteMeeting,
  onToggleFolder,
}: NotesVaultPanelProps) {
  const [newFolderParent, setNewFolderParent] = useState<string | null | undefined>(undefined)
  const rootFolders = childFolders(folders, null)
  const inboxNotes = sessionsInFolder(sessions, null)
  const inboxOpen = expandedFolderIds.includes('__inbox__')

  const commitNewFolder = useCallback(
    (name: string) => {
      const parent = newFolderParent === undefined ? null : newFolderParent
      onNewFolder(parent, name.trim() || 'New folder')
      setNewFolderParent(undefined)
    },
    [newFolderParent, onNewFolder],
  )

  return (
    <div className="px-2 pb-2" data-testid="notes-vault-panel">
      <div className="mb-2 flex flex-wrap justify-end gap-1">
        <button
          type="button"
          onClick={() => setNewFolderParent(null)}
          data-testid="notes-new-folder"
          className="rounded px-2 py-0.5 text-[11px] font-medium text-[var(--uv-text-secondary)] hover:bg-[var(--uv-bg-hover)]"
        >
          + Folder
        </button>
        <button
          type="button"
          onClick={() => onNewNote(null)}
          data-testid="notes-new-meeting"
          className="rounded px-2 py-0.5 text-[11px] font-medium text-[var(--uv-accent)] hover:bg-[var(--uv-accent-dim)]"
        >
          + Note
        </button>
      </div>

      <p className="mb-1.5 text-[10px] text-[var(--uv-text-muted)]">Drag notes or folders to organize.</p>

      {newFolderParent !== undefined ? (
        <form
          className="mb-2 flex gap-1"
          onSubmit={(e) => {
            e.preventDefault()
            const name = new FormData(e.currentTarget).get('folderName')
            commitNewFolder(String(name ?? ''))
            e.currentTarget.reset()
          }}
        >
          <input
            name="folderName"
            autoFocus
            placeholder="Folder name ↵"
            data-testid="notes-new-folder-input"
            className="min-w-0 flex-1 rounded border border-[var(--uv-border)] bg-[var(--uv-bg-elevated)] px-2 py-1 text-[11px] focus:border-[var(--uv-accent)] focus:outline-none"
          />
        </form>
      ) : null}

      <ul className="max-h-60 space-y-0 overflow-y-auto">
        <li data-testid="notes-folder-inbox">
          <FolderDropHeader
            folderId={null}
            dropTestId="notes-folder-drop-inbox"
            depth={0}
            open={inboxOpen}
            label="Inbox"
            count={inboxNotes.length}
            onToggle={() => onToggleFolder('__inbox__')}
            onDropNote={(sessionId) => onMoveNote(sessionId, null)}
            onDropFolder={(folderId) => onMoveFolder(folderId, null)}
          />
          {inboxOpen ? (
            <ul className="space-y-0">
              {inboxNotes.map((s) => (
                <NoteRow
                  key={s.id}
                  session={s}
                  active={s.id === activeSessionId}
                  onSelect={() => onSelectMeeting(s)}
                  onDelete={() => onDeleteMeeting(s.id)}
                />
              ))}
            </ul>
          ) : null}
        </li>

        {rootFolders.map((folder) => (
          <FolderBranch
            key={folder.id}
            folder={folder}
            depth={0}
            sessions={sessions}
            folders={folders}
            activeSessionId={activeSessionId}
            expandedFolderIds={expandedFolderIds}
            onSelectMeeting={onSelectMeeting}
            onNewNote={onNewNote}
            onOpenNewFolderForm={setNewFolderParent}
            onDeleteFolder={onDeleteFolder}
            onMoveNote={onMoveNote}
            onMoveFolder={onMoveFolder}
            onDeleteMeeting={onDeleteMeeting}
            onToggleFolder={onToggleFolder}
          />
        ))}
      </ul>
    </div>
  )
}
