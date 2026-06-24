import { attachmentIdsInNotes, newAttachmentId, attachmentDataUrl, parseSpreadsheetFile } from '../src/lib/notes/attachments'
import type { Screenshot } from '../src/lib/notes/types'

const id = newAttachmentId('test')
const shot: Screenshot = {
  id,
  base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  mimeType: 'image/png',
  kind: 'image',
}
const marker = `[📎 ${id}]`
const legacyMarker = `[📷 ${id}]`

for (const m of [marker, legacyMarker]) {
  const ids = attachmentIdsInNotes(`before\n${m}\nafter`)
  if (ids.length !== 1 || ids[0] !== id) {
    console.error('attachmentIdsInNotes failed for', m, ids)
    process.exit(1)
  }
}

const url = attachmentDataUrl(shot)
if (!url.startsWith('data:image/png;base64,')) {
  console.error('attachmentDataUrl failed', url.slice(0, 40))
  process.exit(1)
}

async function main() {
  const file = new File(['Name,Value\nAlpha,1\nBeta,2'], 'sample.csv', { type: 'text/csv' })
  const preview = await parseSpreadsheetFile(file)
  if (!preview || preview.headers[0] !== 'Name' || preview.rows[0]?.[1] !== '1') {
    console.error('parseSpreadsheetFile csv failed', preview)
    process.exit(1)
  }
  console.log('✓ attachmentIdsInNotes (📎 + 📷)')
  console.log('✓ attachmentDataUrl')
  console.log('✓ parseSpreadsheetFile csv')
  console.log('All attachment checks passed.')
}

void main()
