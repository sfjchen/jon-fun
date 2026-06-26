'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { NoteFolder, NoteSession } from '@/lib/notes/types'
import { childFolders, findArchiveFolder, isArchiveFolder, sessionsInFolder } from '@/lib/notes/folders'
import { useNotesDevice } from '@/lib/notes/useNotesDevice'
import {
  NotesContextMenu,
  NotesOverflowMenu,
  NotesRowAction,
  useNotesContextTrigger,
} from './NotesActionUi'

import { NOTE_FOLDER_DRAG, NOTE_SESSION_DRAG } from '@/lib/notes/dragTypes'

const NOTE_DRAG = NOTE_SESSION_DRAG
const FOLDER_DRAG = NOTE_FOLDER_DRAG

function isNoteActive(sessionId: string, activeSessionId: string, splitSessionId?: string | null): boolean {
  return sessionId === activeSessionId || (!!splitSessionId && sessionId === splitSessionId)
}

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

const NOTE_DRAG_THRESHOLD_PX = 6

function useNoteDragGate(editing: boolean) {
  const dragOkRef = useRef(false)

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (editing || e.button !== 0) return
      dragOkRef.current = false
      const sx = e.clientX
      const sy = e.clientY
      const thresholdSq = NOTE_DRAG_THRESHOLD_PX * NOTE_DRAG_THRESHOLD_PX
      const onMove = (ev: PointerEvent) => {
        const dx = ev.clientX - sx
        const dy = ev.clientY - sy
        if (dx * dx + dy * dy >= thresholdSq) dragOkRef.current = true
      }
      const onUp = () => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        window.removeEventListener('pointercancel', onUp)
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
      window.addEventListener('pointercancel', onUp)
    },
    [editing],
  )

  return { dragOkRef, onPointerDown }
}

function startNoteDrag(e: React.DragEvent, sessionId: string) {
  e.dataTransfer.setData(NOTE_DRAG, sessionId)
  e.dataTransfer.setData('text/plain', sessionId)
  e.dataTransfer.effectAllowed = 'move'
  document.documentElement.setAttribute('data-notes-vault-drag', '1')
}

function endNoteDrag() {
  document.documentElement.removeAttribute('data-notes-vault-drag')
}

type NotesVaultPanelProps = {
  sessions: NoteSession[]
  folders: NoteFolder[]
  activeSessionId: string
  splitSessionId?: string | null | undefined
  expandedFolderIds: string[]
  onSelectMeeting: (session: NoteSession) => void
  onNewNote: (folderId: string | null) => void
  onNewFolder: (parentId: string | null, name: string) => void
  onDeleteFolder: (folderId: string) => void
  onMoveNote: (sessionId: string, folderId: string | null) => void
  onMoveFolder: (folderId: string, parentId: string | null) => void
  onDeleteMeeting: (sessionId: string) => void
  onToggleFolder: (folderId: string) => void
  onRenameMeeting: (sessionId: string, title: string) => void
  onArchiveNote: (sessionId: string) => void
}

function NoteRow({
  session,
  active,
  archived,
  onSelect,
  onDelete,
  onRename,
  onArchive,
}: {
  session: NoteSession
  active: boolean
  archived?: boolean
  onSelect: () => void
  onDelete: () => void
  onRename: (title: string) => void
  onArchive: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const selectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { isMobile } = useNotesDevice()

  const menuItems = [
    ...(archived ? [] : [{ id: 'archive', label: 'Archive note', onClick: onArchive }]),
    { id: 'delete', label: 'Delete note', danger: true, onClick: onDelete },
  ]

  const { state, close, onContextMenu, touchHandlers } = useNotesContextTrigger(() => menuItems)
  const { dragOkRef, onPointerDown: onTitlePointerDown } = useNoteDragGate(editing)

  const handleNoteDragStart = useCallback(
    (e: React.DragEvent, immediate = false) => {
      if (editing) {
        e.preventDefault()
        return
      }
      if (!immediate && !dragOkRef.current) {
        e.preventDefault()
        return
      }
      startNoteDrag(e, session.id)
    },
    [editing, dragOkRef, session.id],
  )

  const handleNoteDragEnd = useCallback(() => {
    dragOkRef.current = false
    endNoteDrag()
  }, [dragOkRef])

  useEffect(() => {
    if (editing) inputRef.current?.select()
  }, [editing])

  useEffect(() => {
    return () => {
      if (selectTimerRef.current) clearTimeout(selectTimerRef.current)
    }
  }, [])

  function startEdit(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (selectTimerRef.current) {
      clearTimeout(selectTimerRef.current)
      selectTimerRef.current = null
    }
    setDraft(session.title)
    setEditing(true)
  }

  function scheduleSelect() {
    if (editing) return
    if (selectTimerRef.current) clearTimeout(selectTimerRef.current)
    selectTimerRef.current = setTimeout(() => {
      selectTimerRef.current = null
      onSelect()
    }, 250)
  }

  function commitEdit() {
    const next = (inputRef.current?.value ?? draft).trim()
    setEditing(false)
    if (next !== (session.title || '').trim()) onRename(next)
  }

  function cancelEdit() {
    setEditing(false)
    setDraft('')
  }

  return (
    <li
      className="group flex items-center gap-0.5 pl-2"
      data-testid={`notes-note-row-${session.id}`}
      onContextMenu={editing ? undefined : onContextMenu}
      {...(editing ? {} : touchHandlers)}
    >
      <span
        draggable={!editing}
        title="Drag to folder"
        aria-hidden
        className="cursor-grab shrink-0 rounded px-0.5 text-[10px] text-[var(--uv-text-muted)] opacity-0 group-hover:opacity-40 hover:!opacity-70 active:cursor-grabbing"
        data-testid={`notes-note-drag-${session.id}`}
        onDragStart={(e) => handleNoteDragStart(e, true)}
        onDragEnd={handleNoteDragEnd}
      >
        ⠿
      </span>
      <button
        type="button"
        data-testid={`notes-meeting-item-${session.id}`}
        data-active={active ? 'true' : 'false'}
        onClick={editing ? undefined : scheduleSelect}
        onDoubleClick={(e) => {
          if (editing) return
          e.preventDefault()
          e.stopPropagation()
          startEdit(e)
        }}
        className={`flex min-w-0 flex-1 items-center gap-2 rounded px-2 py-0.5 text-left text-xs ${
          active
            ? 'notes-meeting-active text-[var(--uv-text-primary)]'
            : 'text-[var(--uv-text-secondary)] hover:bg-[var(--uv-bg-hover)]'
        }`}
      >
        {editing ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                commitEdit()
              } else if (e.key === 'Escape') {
                e.preventDefault()
                cancelEdit()
              }
            }}
            onBlur={commitEdit}
            autoFocus
            data-testid={`notes-sidebar-title-input-${session.id}`}
            aria-label="Rename note"
            spellCheck={false}
            autoCorrect="off"
            autoComplete="off"
            autoCapitalize="off"
            className="min-w-0 flex-1 rounded border border-[var(--uv-accent)] bg-[var(--uv-bg-base)] px-1 py-0 text-xs text-[var(--uv-text-primary)] focus:outline-none"
          />
        ) : (
          <span
            draggable
            onPointerDown={onTitlePointerDown}
            onDragStart={(e) => handleNoteDragStart(e)}
            onDragEnd={handleNoteDragEnd}
            title="Drag to move or split · double-click to rename"
            data-testid={`notes-note-drag-title-${session.id}`}
            className="min-w-0 flex-1 cursor-grab truncate select-none active:cursor-grabbing"
          >
            {session.title || 'Untitled'}
          </span>
        )}
        <span className="shrink-0 text-[10px] tabular-nums text-[var(--uv-text-muted)]">
          {formatMeetingDate(session.updatedAt)}
        </span>
      </button>
      {!editing ? (
        isMobile ? (
          <NotesOverflowMenu
            label={`Note actions for ${session.title || 'note'}`}
            testId={`notes-note-overflow-${session.id}`}
            items={menuItems}
          />
        ) : (
          <NotesRowAction
            label={`Delete ${session.title || 'note'}`}
            testId={`notes-delete-meeting-${session.id}`}
            onClick={onDelete}
          />
        )
      ) : null}
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
      const noteId =
        e.dataTransfer.getData(NOTE_DRAG) ||
        (e.dataTransfer.types.includes(FOLDER_DRAG) ? '' : e.dataTransfer.getData('text/plain'))
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
  locked,
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
  locked?: boolean
  onToggle: () => void
  onNewNote: () => void
  onOpenNewFolderForm: () => void
  onDeleteFolder: () => void
}) {
  const { isMobile } = useNotesDevice()
  const overflowItems = locked
    ? [{ id: 'new-note', label: 'New note in folder', onClick: onNewNote }]
    : [
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
          {!locked ? (
            <>
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
          ) : null}
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
  splitSessionId,
  expandedFolderIds,
  onSelectMeeting,
  onNewNote,
  onOpenNewFolderForm,
  onDeleteFolder,
  onMoveNote,
  onMoveFolder,
  onDeleteMeeting,
  onToggleFolder,
  onRenameMeeting,
  onArchiveNote,
  archiveFolderId,
}: {
  folder: NoteFolder
  depth: number
  sessions: NoteSession[]
  folders: NoteFolder[]
  activeSessionId: string
  splitSessionId?: string | null | undefined
  expandedFolderIds: string[]
  onSelectMeeting: (s: NoteSession) => void
  onNewNote: (folderId: string | null) => void
  onOpenNewFolderForm: (parentId: string | null) => void
  onDeleteFolder: (folderId: string) => void
  onMoveNote: (sessionId: string, folderId: string | null) => void
  onMoveFolder: (folderId: string, parentId: string | null) => void
  onDeleteMeeting: (sessionId: string) => void
  onToggleFolder: (folderId: string) => void
  onRenameMeeting: (sessionId: string, title: string) => void
  onArchiveNote: (sessionId: string) => void
  archiveFolderId?: string
}) {
  const open = expandedFolderIds.includes(folder.id)
  const notes = sessionsInFolder(sessions, folder.id)
  const subfolders = childFolders(folders, folder.id)
  const locked = isArchiveFolder(folder)

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
          locked={locked}
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
                  active={isNoteActive(s.id, activeSessionId, splitSessionId)}
                  archived={archiveFolderId === folder.id}
                  onSelect={() => onSelectMeeting(s)}
                  onDelete={() => onDeleteMeeting(s.id)}
                  onRename={(title) => onRenameMeeting(s.id, title)}
                  onArchive={() => onArchiveNote(s.id)}
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
                  splitSessionId={splitSessionId}
                  expandedFolderIds={expandedFolderIds}
                  onSelectMeeting={onSelectMeeting}
                  onNewNote={onNewNote}
                  onOpenNewFolderForm={onOpenNewFolderForm}
                  onDeleteFolder={onDeleteFolder}
                  onMoveNote={onMoveNote}
                  onMoveFolder={onMoveFolder}
                  onDeleteMeeting={onDeleteMeeting}
                  onToggleFolder={onToggleFolder}
                  onRenameMeeting={onRenameMeeting}
                  onArchiveNote={onArchiveNote}
                  {...(archiveFolderId ? { archiveFolderId } : {})}
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
  splitSessionId,
  expandedFolderIds,
  onSelectMeeting,
  onNewNote,
  onNewFolder,
  onDeleteFolder,
  onMoveNote,
  onMoveFolder,
  onDeleteMeeting,
  onToggleFolder,
  onRenameMeeting,
  onArchiveNote,
}: NotesVaultPanelProps) {
  const [newFolderParent, setNewFolderParent] = useState<string | null | undefined>(undefined)
  const archiveFolder = findArchiveFolder(folders)
  const rootFolders = childFolders(folders, null).filter((f) => f.id !== archiveFolder?.id)
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
                        active={isNoteActive(s.id, activeSessionId, splitSessionId)}
                        onSelect={() => onSelectMeeting(s)}
                        onDelete={() => onDeleteMeeting(s.id)}
                        onRename={(title) => onRenameMeeting(s.id, title)}
                        onArchive={() => onArchiveNote(s.id)}
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
            splitSessionId={splitSessionId}
            expandedFolderIds={expandedFolderIds}
            onSelectMeeting={onSelectMeeting}
            onNewNote={onNewNote}
            onOpenNewFolderForm={setNewFolderParent}
            onDeleteFolder={onDeleteFolder}
            onMoveNote={onMoveNote}
            onMoveFolder={onMoveFolder}
            onDeleteMeeting={onDeleteMeeting}
            onToggleFolder={onToggleFolder}
            onRenameMeeting={onRenameMeeting}
            onArchiveNote={onArchiveNote}
            {...(archiveFolder ? { archiveFolderId: archiveFolder.id } : {})}
          />
        ))}

        {archiveFolder ? (
          <FolderBranch
            key={archiveFolder.id}
            folder={archiveFolder}
            depth={0}
            sessions={sessions}
            folders={folders}
            activeSessionId={activeSessionId}
            splitSessionId={splitSessionId}
            expandedFolderIds={expandedFolderIds}
            onSelectMeeting={onSelectMeeting}
            onNewNote={onNewNote}
            onOpenNewFolderForm={setNewFolderParent}
            onDeleteFolder={onDeleteFolder}
            onMoveNote={onMoveNote}
            onMoveFolder={onMoveFolder}
            onDeleteMeeting={onDeleteMeeting}
            onToggleFolder={onToggleFolder}
            onRenameMeeting={onRenameMeeting}
            onArchiveNote={onArchiveNote}
            archiveFolderId={archiveFolder.id}
          />
        ) : null}
      </ul>
    </div>
  )
}
