/** MIME type for dragging a note session from the vault into editor split zones. */
export const NOTE_SESSION_DRAG = 'application/x-notes-session-id'

/** MIME type for dragging folders in the vault tree. */
export const NOTE_FOLDER_DRAG = 'application/x-notes-folder-id'

export function isNoteSessionDrag(e: React.DragEvent): boolean {
  return e.dataTransfer.types.includes(NOTE_SESSION_DRAG)
}
