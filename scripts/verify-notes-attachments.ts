import { attachmentIdsInNotes, newAttachmentId, screenshotDataUrl } from '../src/lib/notes/attachments'
import type { Screenshot } from '../src/lib/notes/types'

const id = newAttachmentId('test')
const shot: Screenshot = {
  id,
  base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  mimeType: 'image/png',
}
const marker = `[📷 ${id}]`

const ids = attachmentIdsInNotes(`before\n${marker}\nafter`)
if (ids.length !== 1 || ids[0] !== id) {
  console.error('attachmentIdsInNotes failed', ids)
  process.exit(1)
}

const url = screenshotDataUrl(shot)
if (!url.startsWith('data:image/png;base64,')) {
  console.error('screenshotDataUrl failed', url.slice(0, 40))
  process.exit(1)
}

console.log('✓ attachmentIdsInNotes')
console.log('✓ screenshotDataUrl')
console.log('All attachment checks passed.')
