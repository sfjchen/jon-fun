'use client'

import { useCallback, useState } from 'react'
import type { NoteFolder, NoteSession } from '@/lib/notes/types'
import { childFolders, sessionsInFolder } from '@/lib/notes/folders'

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
  onDeleteMeeting: (sessionId: string) => void
  onToggleFolder: (folderId: string) => void
}

function NoteRow({
  session,
  active,
  folders,
  onSelect,
  onMove,
  onDelete,
}: {
  session: NoteSession
  active: boolean
  folders: NoteFolder[]
  onSelect: () => void
  onMove: (folderId: string | null) => void
  onDelete: () => void
}) {
  return (
    <li className="group flex items-center gap-0.5 pl-4">
      <button
        type="button"
        data-testid={`notes-meeting-item-${session.id}`}
        data-active={active ? 'true' : 'false'}
        onClick={onSelect}
        className={`min-w-0 flex-1 truncate rounded px-2 py-1 text-left text-xs ${
          active
            ? 'notes-meeting-active text-[var(--uv-text-primary)]'
            : 'text-[var(--uv-text-secondary)] hover:bg-[var(--uv-bg-hover)]'
        }`}
      >
        <span className="block truncate">{session.title || 'Untitled'}</span>
        <span className="text-[10px] text-[var(--uv-text-muted)]">{formatMeetingDate(session.updatedAt)}</span>
      </button>
      {folders.length > 0 ? (
        <select
          aria-label="Move to folder"
          data-testid={`notes-move-folder-${session.id}`}
          className="max-w-[4.5rem] shrink-0 rounded border border-transparent bg-transparent text-[9px] text-[var(--uv-text-muted)] opacity-0 group-hover:opacity-100 focus:border-[var(--uv-border)] focus:opacity-100"
          value={session.metadata?.folderId ?? ''}
          onChange={(e) => onMove(e.target.value || null)}
          onClick={(e) => e.stopPropagation()}
        >
          <option value="">Inbox</option>
          {folders.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      ) : null}
      <button
        type="button"
        aria-label={`Delete ${session.title || 'note'}`}
        data-testid={`notes-delete-meeting-${session.id}`}
        onClick={(e) => {
          e.stopPropagation()
          onDelete()
        }}
        className="shrink-0 rounded px-1 text-[10px] text-[var(--uv-text-muted)] opacity-0 hover:text-red-600 group-hover:opacity-100"
      >
        ×
      </button>
    </li>
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
  onDeleteMeeting: (sessionId: string) => void
  onToggleFolder: (folderId: string) => void
}) {
  const open = expandedFolderIds.includes(folder.id)
  const notes = sessionsInFolder(sessions, folder.id)
  const subfolders = childFolders(folders, folder.id)
  const pad = { paddingLeft: `${8 + depth * 10}px` }

  return (
    <li data-testid={`notes-folder-${folder.id}`}>
      <div className="group flex items-center gap-0.5" style={pad}>
        <button
          type="button"
          onClick={() => onToggleFolder(folder.id)}
          className="flex min-w-0 flex-1 items-center gap-1 rounded px-1 py-1 text-left text-[11px] font-medium text-[var(--uv-text-primary)] hover:bg-[var(--uv-bg-hover)]"
          data-testid={`notes-folder-toggle-${folder.id}`}
        >
          <span className="text-[10px] text-[var(--uv-text-muted)]">{open ? '▾' : '▸'}</span>
          <span className="truncate">{folder.name}</span>
          <span className="text-[10px] font-normal text-[var(--uv-text-muted)]">({notes.length})</span>
        </button>
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
      </div>
      {open ? (
        <>
          <ul className="space-y-0.5">
            {notes.map((s) => (
              <NoteRow
                key={s.id}
                session={s}
                active={s.id === activeSessionId}
                folders={folders}
                onSelect={() => onSelectMeeting(s)}
                onMove={(fid) => onMoveNote(s.id, fid)}
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

      <ul className="max-h-52 space-y-0.5 overflow-y-auto">
        <li data-testid="notes-folder-inbox">
          <div className="flex items-center gap-1 px-1 py-1">
            <button
              type="button"
              onClick={() => onToggleFolder('__inbox__')}
              className="flex min-w-0 flex-1 items-center gap-1 text-left text-[11px] font-medium text-[var(--uv-text-primary)] hover:bg-[var(--uv-bg-hover)]"
              data-testid="notes-folder-toggle-__inbox__"
            >
              <span className="text-[10px] text-[var(--uv-text-muted)]">{inboxOpen ? '▾' : '▸'}</span>
              <span>Inbox</span>
              <span className="text-[10px] font-normal text-[var(--uv-text-muted)]">({inboxNotes.length})</span>
            </button>
          </div>
          {inboxOpen ? (
            <ul className="space-y-0.5">
              {inboxNotes.map((s) => (
                <NoteRow
                  key={s.id}
                  session={s}
                  active={s.id === activeSessionId}
                  folders={folders}
                  onSelect={() => onSelectMeeting(s)}
                  onMove={(fid) => onMoveNote(s.id, fid)}
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
            onDeleteMeeting={onDeleteMeeting}
            onToggleFolder={onToggleFolder}
          />
        ))}
      </ul>
    </div>
  )
}
