'use client'

import { useCallback, useState } from 'react'
import type { NoteFolder, NoteSession } from '@/lib/notes/types'
import { childFolders, sessionsInFolder } from '@/lib/notes/folders'
import { useNotesDevice } from '@/lib/notes/useNotesDevice'
import {
  NotesContextMenu,
  NotesOverflowMenu,
  NotesRowAction,
  useNotesContextTrigger,
} from './NotesActionUi'

const NOTE_DRAG = 'application/x-notes-session-id'
const FOLDER_DRAG = 'application/x-notes-folder-id'

function formatMeetingDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function isVaultDrag(e: React.DragEvent): boolean {
  const types = e.dataTransfer.types
  return types.includes(NOTE_DRAG) || types.includes(FOLDER_DRAG)
}

function acceptVaultDrag(e: React.DragEvent): void {
  if (!isVaultDrag(e)) return
  e.preventDefault()
  e.dataTransfer.dropEffect = 'move'
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
  const { state, close, onContextMenu, touchHandlers } = useNotesContextTrigger(() => [
    { id: 'delete', label: 'Delete note', danger: true, onClick: onDelete },
  ])

  return (
    <li
      className="group flex items-center gap-0.5 pl-2"
      draggable
      data-testid={`notes-note-row-${session.id}`}
      onContextMenu={onContextMenu}
      {...touchHandlers}
      onDragStart={(e) => {
        e.dataTransfer.setData(NOTE_DRAG, session.id)
        e.dataTransfer.setData('text/plain', session.id)
        e.dataTransfer.effectAllowed = 'move'
      }}
    >
      <span
        title="Drag to folder"
        aria-hidden
        className="cursor-grab shrink-0 rounded px-0.5 text-[10px] text-[var(--uv-text-muted)] opacity-60 hover:opacity-100 active:cursor-grabbing"
        data-testid={`notes-note-drag-${session.id}`}
      >
        ⠿
      </span>
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
      <NotesRowAction
        label={`Delete ${session.title || 'note'}`}
        testId={`notes-delete-meeting-${session.id}`}
        onClick={onDelete}
      />
      <NotesContextMenu state={state} onClose={close} />
    </li>
  )
}

function FolderDropZone({
  folderId,
  dropTestId,
  depth,
  over,
  onDragEnter,
  onDragLeave,
  onDrop,
  children,
}: {
  folderId: string | null
  dropTestId: string
  depth: number
  over: boolean
  onDragEnter: () => void
  onDragLeave: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent) => void
  children: React.ReactNode
}) {
  const pad = { paddingLeft: `${8 + depth * 10}px` }

  return (
    <div
      style={pad}
      data-testid={dropTestId}
      data-folder-id={folderId ?? '__inbox__'}
      className={`rounded ${over ? 'bg-[var(--uv-accent-dim)] ring-1 ring-[var(--uv-accent)]' : ''}`}
      onDragEnter={(e) => {
        acceptVaultDrag(e)
        onDragEnter()
      }}
      onDragOverCapture={acceptVaultDrag}
      onDragLeave={onDragLeave}
      onDrop={(e) => {
        acceptVaultDrag(e)
        onDrop(e)
        e.stopPropagation()
      }}
    >
      {children}
    </div>
  )
}

function useFolderDropHandlers(
  folderId: string | null,
  selfFolderId: string | undefined,
  onDropNote: (sessionId: string) => void,
  onDropFolder: (folderId: string) => void,
) {
  const [over, setOver] = useState(false)

  const onDragLeave = useCallback((e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(false)
  }, [])

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setOver(false)
      const noteId = e.dataTransfer.getData(NOTE_DRAG)
      const fldId = e.dataTransfer.getData(FOLDER_DRAG)
      if (noteId) onDropNote(noteId)
      else if (fldId && fldId !== selfFolderId) onDropFolder(fldId)
    },
    [onDropNote, onDropFolder, selfFolderId],
  )

  return { over, setOver, onDragLeave, onDrop }
}

function FolderHeader({
  folderId,
  open,
  label,
  count,
  dragFolderId,
  onToggle,
  onNewNote,
  onOpenNewFolderForm,
  onDeleteFolder,
}: {
  folderId: string
  open: boolean
  label: string
  count: number
  dragFolderId: string
  onToggle: () => void
  onNewNote: () => void
  onOpenNewFolderForm: () => void
  onDeleteFolder: () => void
}) {
  const { isMobile } = useNotesDevice()
  const overflowItems = [
    { id: 'new-note', label: 'New note in folder', onClick: onNewNote },
    { id: 'new-subfolder', label: 'New subfolder', onClick: onOpenNewFolderForm },
    { id: 'delete', label: 'Delete folder', danger: true, onClick: onDeleteFolder },
  ]

  return (
    <div className="group flex items-center gap-0.5">
      <span
        draggable
        title="Drag folder"
        aria-label={`Drag folder ${label}`}
        data-testid={`notes-folder-drag-${folderId}`}
        onDragStart={(e) => {
          e.dataTransfer.setData(FOLDER_DRAG, dragFolderId)
          e.dataTransfer.setData('text/plain', dragFolderId)
          e.dataTransfer.effectAllowed = 'move'
          e.stopPropagation()
        }}
        className="cursor-grab shrink-0 rounded px-0.5 text-[10px] text-[var(--uv-text-muted)] opacity-60 hover:opacity-100 active:cursor-grabbing"
      >
        ⠿
      </span>
      <button
        type="button"
        onClick={onToggle}
        className="flex min-w-0 flex-1 items-center gap-1 rounded px-1 py-0.5 text-left text-[11px] font-medium text-[var(--uv-text-primary)] hover:bg-[var(--uv-bg-hover)]"
        data-testid={`notes-folder-toggle-${folderId}`}
      >
        <span className="text-[10px] text-[var(--uv-text-muted)]">{open ? '▾' : '▸'}</span>
        <span className="truncate">{label}</span>
        <span className="text-[10px] font-normal text-[var(--uv-text-muted)]">({count})</span>
      </button>
      {isMobile ? (
        <NotesOverflowMenu
          label={`Folder actions for ${label}`}
          testId={`notes-folder-overflow-${folderId}`}
          items={overflowItems}
        />
      ) : (
        <>
          <button
            type="button"
            title="New note in folder"
            onClick={onNewNote}
            className="notes-row-action shrink-0 rounded px-1 text-[10px] text-[var(--uv-accent)] hover:bg-[var(--uv-accent-dim)]"
          >
            +
          </button>
          <button
            type="button"
            title="New subfolder"
            onClick={onOpenNewFolderForm}
            className="notes-row-action shrink-0 rounded px-1 text-[10px] text-[var(--uv-text-muted)] hover:bg-[var(--uv-bg-hover)]"
          >
            +↳
          </button>
          <NotesRowAction
            label={`Delete folder ${label}`}
            testId={`notes-delete-folder-${folderId}`}
            onClick={onDeleteFolder}
          />
        </>
      )}
    </div>
  )
}

function InboxHeader({ open, count, onToggle }: { open: boolean; count: number; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex min-w-0 flex-1 items-center gap-1 rounded px-1 py-0.5 text-left text-[11px] font-medium text-[var(--uv-text-primary)] hover:bg-[var(--uv-bg-hover)]"
      data-testid="notes-folder-toggle-__inbox__"
    >
      <span className="text-[10px] text-[var(--uv-text-muted)]">{open ? '▾' : '▸'}</span>
      <span className="truncate">Inbox</span>
      <span className="text-[10px] font-normal text-[var(--uv-text-muted)]">({count})</span>
    </button>
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

  const { over, setOver, onDragLeave, onDrop } = useFolderDropHandlers(
    folder.id,
    folder.id,
    handleDropNote,
    handleDropFolder,
  )

  return (
    <li data-testid={`notes-folder-${folder.id}`}>
      <FolderDropZone
        folderId={folder.id}
        dropTestId={`notes-folder-drop-${folder.id}`}
        depth={depth}
        over={over}
        onDragEnter={() => setOver(true)}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <FolderHeader
          folderId={folder.id}
          open={open}
          label={folder.name}
          count={notes.length}
          dragFolderId={folder.id}
          onToggle={() => onToggleFolder(folder.id)}
          onNewNote={() => onNewNote(folder.id)}
          onOpenNewFolderForm={() => onOpenNewFolderForm(folder.id)}
          onDeleteFolder={() => onDeleteFolder(folder.id)}
        />
        {open ? (
          <div
            className="min-h-6 py-0.5"
            data-testid={`notes-folder-body-${folder.id}`}
          >
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
          </div>
        ) : null}
      </FolderDropZone>
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

  const handleInboxDropNote = useCallback(
    (sessionId: string) => onMoveNote(sessionId, null),
    [onMoveNote],
  )

  const handleInboxDropFolder = useCallback(
    (folderId: string) => onMoveFolder(folderId, null),
    [onMoveFolder],
  )

  const inboxDrop = useFolderDropHandlers(null, undefined, handleInboxDropNote, handleInboxDropFolder)

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
          <FolderDropZone
            folderId={null}
            dropTestId="notes-folder-drop-inbox"
            depth={0}
            over={inboxDrop.over}
            onDragEnter={() => inboxDrop.setOver(true)}
            onDragLeave={inboxDrop.onDragLeave}
            onDrop={inboxDrop.onDrop}
          >
            <InboxHeader open={inboxOpen} count={inboxNotes.length} onToggle={() => onToggleFolder('__inbox__')} />
            {inboxOpen ? (
              <div className="min-h-6 py-0.5" data-testid="notes-folder-body-inbox">
                {inboxNotes.length === 0 ? (
                  <p
                    className="px-2 py-1 text-[11px] text-[var(--uv-text-muted)]"
                    data-testid="notes-inbox-empty"
                  >
                    Inbox empty — tap + Note or start typing.
                  </p>
                ) : (
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
                )}
              </div>
            ) : null}
          </FolderDropZone>
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
