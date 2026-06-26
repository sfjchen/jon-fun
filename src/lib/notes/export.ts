import { marked } from 'marked'
import { collectTodosFromNotes } from './shorthand'
import type { Lookup, NoteSession } from './types'

marked.setOptions({ gfm: true, breaks: true })

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function lookupLabel(lk: Lookup): string {
  return lk.type === 'section' ? `${lk.query}??` : `${lk.query}?`
}

export function exportFilename(session: NoteSession, ext: 'md' | 'pdf'): string {
  const slug =
    (session.title || 'untitled')
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 60)
      .toLowerCase() || 'untitled'
  const date = new Date(session.startedAt).toISOString().slice(0, 10)
  return `notes-${slug}-${date}.${ext}`
}

function escapeExportText(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function markdownLookupBlock(lk: Lookup): string {
  const lines = [`### ${lookupLabel(lk)}`, `_${formatDateTime(lk.triggeredAt)}_`, '']
  if (lk.conversation.length === 0) {
    lines.push('_No conversation recorded_')
  } else {
    for (const msg of lk.conversation) {
      if (msg.role === 'user') lines.push(`**Q:** ${msg.content}`, '')
      else lines.push(`**A:** ${msg.content}`, '')
    }
  }
  return lines.join('\n').trimEnd()
}

/** Structured markdown export for a note session. */
export function buildSessionMarkdown(session: NoteSession): string {
  const title = escapeExportText(session.title?.trim() || 'Untitled')
  const tags = (session.tags?.filter(Boolean) ?? []).map(escapeExportText)
  const todos = collectTodosFromNotes(session.notes)
  const lookupBlocks = session.lookups.map(markdownLookupBlock)
  const notesBody = session.notes.trim() || '_Empty_'

  return [
    `# ${title}`,
    '',
    `**Created:** ${formatDateTime(session.startedAt)}  `,
    `**Modified:** ${formatDateTime(session.updatedAt)}  `,
    tags.length ? `**Tags:** ${tags.map((t) => `\`${t}\``).join(', ')}  ` : '',
    '',
    '---',
    '',
    '## Notes',
    '',
    notesBody,
    '',
    '---',
    '',
    '## AI Lookups',
    '',
    lookupBlocks.length ? lookupBlocks.join('\n\n---\n\n') : '_None_',
    '',
    '---',
    '',
    '## Action Items',
    '',
    todos.length ? todos.map((t) => `- [ ] ${t.text}`).join('\n') : '_None_',
    '',
  ]
    .filter((line, i, arr) => !(line === '' && arr[i - 1] === ''))
    .join('\n')
    .trimEnd() + '\n'
}

/** @deprecated use buildSessionMarkdown */
export const exportSessionMarkdown = buildSessionMarkdown

function htmlLookupBlock(lk: Lookup): string {
  const parts = [`<h3>${escapeHtml(lookupLabel(lk))}</h3>`, `<p class="meta">${escapeHtml(formatDateTime(lk.triggeredAt))}</p>`]
  if (lk.conversation.length === 0) {
    parts.push('<p><em>No conversation recorded</em></p>')
  } else {
    for (const msg of lk.conversation) {
      const label = msg.role === 'user' ? 'Q' : 'A'
      parts.push(`<p class="lookup"><strong>${label}:</strong> ${escapeHtml(msg.content).replace(/\n/g, '<br>')}</p>`)
    }
  }
  return parts.join('\n')
}

function escapeHtml(s: string): string {
  return escapeExportText(s)
}

const EXPORT_CSS = `
  * { box-sizing: border-box; }
  body {
    font-family: Georgia, 'Times New Roman', Times, serif;
    font-size: 11pt;
    line-height: 1.25;
    color: #1a1a1a;
    margin: 0;
    padding: 0;
  }
  h1 { font-size: 22pt; font-weight: 700; margin: 0 0 10pt; line-height: 1.2; }
  h2 {
    font-size: 14pt;
    font-weight: 700;
    margin: 22pt 0 10pt;
    padding-bottom: 4pt;
    border-bottom: 1px solid #ccc;
  }
  h3 { font-size: 12pt; font-weight: 700; margin: 14pt 0 6pt; }
  .meta { color: #555; font-size: 10pt; margin: 0 0 14pt; }
  .meta-line { margin: 2pt 0; }
  .notes-body { margin-top: 8pt; }
  .notes-body p { margin: 6pt 0; }
  .notes-body ul, .notes-body ol { margin: 8pt 0; padding-left: 22pt; }
  .notes-body li { margin: 3pt 0; }
  .notes-body code { font-family: ui-monospace, monospace; font-size: 10pt; background: #f4f4f4; padding: 1pt 3pt; }
  .notes-body pre { background: #f4f4f4; padding: 8pt; overflow-x: auto; font-size: 9pt; }
  .notes-body strong { font-weight: 700; }
  .lookup { margin: 6pt 0 10pt 12pt; }
  .lookup-block { margin-bottom: 16pt; padding-bottom: 12pt; border-bottom: 1px solid #eee; }
  .lookup-block:last-child { border-bottom: none; }
  .action-list { margin: 8pt 0; padding-left: 22pt; }
  .action-list li { margin: 4pt 0; }
  hr { border: none; border-top: 1px solid #ddd; margin: 16pt 0; }
  .tag { display: inline-block; background: #eef4ff; color: #1e3a5f; padding: 1pt 6pt; border-radius: 3pt; font-size: 9pt; margin-right: 4pt; }
`

/** Print-ready HTML document for PDF export and visual QA. */
export function buildSessionExportHtml(session: NoteSession): string {
  const title = session.title?.trim() || 'Untitled'
  const tags = session.tags?.filter(Boolean) ?? []
  const todos = collectTodosFromNotes(session.notes)
  const notesHtml = session.notes.trim()
    ? marked.parse(session.notes) as string
    : '<p><em>Empty</em></p>'
  const lookupHtml = session.lookups.length
    ? session.lookups.map((lk) => `<div class="lookup-block">${htmlLookupBlock(lk)}</div>`).join('\n')
    : '<p><em>None</em></p>'
  const actionsHtml = todos.length
    ? `<ul class="action-list">${todos.map((t) => `<li>${escapeHtml(t.text)}</li>`).join('')}</ul>`
    : '<p><em>None</em></p>'

  const tagHtml = tags.length
    ? `<p class="meta-line">${tags.map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</p>`
    : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>${EXPORT_CSS}</style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <div class="meta">
    <p class="meta-line"><strong>Created:</strong> ${escapeHtml(formatDateTime(session.startedAt))}</p>
    <p class="meta-line"><strong>Modified:</strong> ${escapeHtml(formatDateTime(session.updatedAt))}</p>
    ${tagHtml}
  </div>
  <h2>Notes</h2>
  <div class="notes-body">${notesHtml}</div>
  <h2>AI Lookups</h2>
  ${lookupHtml}
  <h2>Action Items</h2>
  ${actionsHtml}
  <hr />
  <p class="meta">Exported from sfjc.dev Notes · ${escapeHtml(formatDate(session.startedAt))}</p>
</body>
</html>`
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function downloadSessionMarkdown(session: NoteSession): void {
  const md = buildSessionMarkdown(session)
  downloadBlob(new Blob([md], { type: 'text/markdown;charset=utf-8' }), exportFilename(session, 'md'))
}

export async function downloadSessionPdf(session: NoteSession): Promise<void> {
  const html = buildSessionExportHtml(session)
  const frame = document.createElement('iframe')
  frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:680px;height:2400px;border:0;visibility:hidden'
  document.body.appendChild(frame)
  const doc = frame.contentDocument
  if (!doc) {
    frame.remove()
    throw new Error('PDF export failed: iframe unavailable')
  }
  doc.open()
  doc.write(html)
  doc.close()
  await doc.fonts.ready

  try {
    const { jsPDF } = await import('jspdf')
    const pdf = new jsPDF({ unit: 'pt', format: 'letter', compress: true })
    await new Promise<void>((resolve, reject) => {
      pdf.html(doc.body, {
        callback: (out) => {
          try {
            out.save(exportFilename(session, 'pdf'))
            resolve()
          } catch (err) {
            reject(err)
          }
        },
        margin: [48, 48, 48, 48],
        autoPaging: 'text',
        width: 516,
        windowWidth: 680,
        html2canvas: { scale: 0.264583, useCORS: true, logging: false },
      })
    })
  } finally {
    frame.remove()
  }
}
