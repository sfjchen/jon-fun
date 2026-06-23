/**
 * Unit checks for Notes export (markdown + HTML preview).
 * Run: npm run verify:notes-export
 */
import assert from 'node:assert/strict'
import { buildSessionExportHtml, buildSessionMarkdown, exportFilename } from '../src/lib/notes/export'
import type { NoteSession } from '../src/lib/notes/types'

function sampleSession(): NoteSession {
  const now = '2026-06-22T15:30:00.000Z'
  return {
    id: 'sess-export-1',
    title: 'IC Review Q2',
    notes: '**DPI gap** flagged by boss\n\nFollow up on *co-invest* terms >\n\nWhat is TVPI?',
    tags: ['IC', 'endowment'],
    metadata: {},
    lookups: [
      {
        id: 'lk-1',
        type: 'line',
        query: 'TVPI',
        context: 'What is TVPI?',
        triggeredAt: '2026-06-22T15:31:00.000Z',
        conversation: [
          { role: 'user', content: 'What is TVPI?' },
          { role: 'assistant', content: 'Total value to paid-in capital — portfolio multiple.' },
        ],
      },
    ],
    screenshots: {},
    startedAt: now,
    updatedAt: now,
  }
}

function run(): void {
  const session = sampleSession()
  const md = buildSessionMarkdown(session)

  assert.match(md, /^# IC Review Q2/m)
  assert.match(md, /\*\*Created:\*\*/)
  assert.match(md, /\*\*Modified:\*\*/)
  assert.match(md, /`IC`/)
  assert.match(md, /## Notes/)
  assert.match(md, /\*\*DPI gap\*\*/)
  assert.match(md, /## AI Lookups/)
  assert.match(md, /### TVPI\?/)
  assert.match(md, /\*\*Q:\*\* What is TVPI\?/)
  assert.match(md, /\*\*A:\*\* Total value to paid-in capital/)
  assert.match(md, /## Action Items/)
  assert.match(md, /- \[ \] Follow up on \*co-invest\* terms/)

  assert.match(exportFilename(session, 'md'), /^notes-ic-review-q2-2026-06-22\.md$/)
  assert.match(exportFilename(session, 'pdf'), /^notes-ic-review-q2-2026-06-22\.pdf$/)

  const html = buildSessionExportHtml(session)
  assert.match(html, /<h1>IC Review Q2<\/h1>/)
  assert.match(html, /<strong>DPI gap<\/strong>/)
  assert.match(html, /TVPI\?/)
  assert.match(html, /Total value to paid-in capital/)
  assert.match(html, /Follow up on/)
  assert.match(html, /class="tag">IC<\/span>/)

  console.log('verify:notes-export OK')
}

run()
