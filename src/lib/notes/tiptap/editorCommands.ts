import type { Editor } from '@tiptap/core'
import { indentDashLineText, parseDashLine } from './dashList'

/** Wrap each selected line with *…* highlight shorthand (skips already-wrapped lines). */
export function wrapLinesWithHighlight(text: string): string {
  return text
    .split('\n')
    .map((line) => {
      if (!line.trim()) return line
      const lead = line.match(/^(\s*)/)?.[1] ?? ''
      const core = line.slice(lead.length)
      const trimmed = core.trim()
      if (trimmed.startsWith('*') && trimmed.endsWith('*') && trimmed.length > 1) return line
      return `${lead}*${trimmed}*`
    })
    .join('\n')
}

export function wrapHighlightSelection(editor: Editor): boolean {
  const { from, to, empty } = editor.state.selection
  if (empty) return false
  const text = editor.state.doc.textBetween(from, to, '\n')
  const wrapped = wrapLinesWithHighlight(text)
  if (wrapped === text) return true
  editor.chain().focus().insertContentAt({ from, to }, wrapped).run()
  return true
}

/** Prefix each selected line with "- " (preserves leading indent). */
export function bullettizeLines(text: string): string {
  return text
    .split('\n')
    .map((line) => {
      if (!line.trim()) return line
      if (parseDashLine(line)) return line
      const lead = line.match(/^(\s*)/)?.[1] ?? ''
      const core = line.slice(lead.length)
      return `${lead}- ${core}`
    })
    .join('\n')
}

export function bullettizeSelection(editor: Editor): boolean {
  const { from, to, empty } = editor.state.selection
  if (empty) return false

  const { state } = editor
  const blocks: { from: number; to: number; text: string }[] = []
  state.doc.nodesBetween(from, to, (node, pos) => {
    if (!node.isTextblock) return
    const blockFrom = pos + 1
    const blockTo = pos + node.nodeSize - 1
    blocks.push({ from: blockFrom, to: blockTo, text: node.textContent })
  })

  if (!blocks.length) return false

  let tr = state.tr
  let changed = false
  const ordered = [...blocks].sort((a, b) => b.from - a.from)

  for (const block of ordered) {
    const next = bullettizeLines(block.text)
    if (next === block.text) continue
    changed = true
    if (block.from >= block.to) {
      tr = tr.insertText(next, block.from)
    } else {
      tr = tr.replaceWith(block.from, block.to, state.schema.text(next))
    }
  }

  if (!changed) return true
  editor.view.dispatch(tr)
  return true
}

export async function pastePlainText(editor: Editor): Promise<boolean> {
  let text = ''
  try {
    text = await navigator.clipboard.readText()
  } catch {
    return false
  }
  if (!text) return true
  const { from, to } = editor.state.selection
  editor.view.dispatch(editor.state.tr.insertText(text, from, to))
  return true
}

/** Add or remove two leading spaces on each block in the selection (dash-aware). */
export function indentBlocks(editor: Editor, outdent = false): boolean {
  const { state } = editor
  const { from, to } = state.selection
  const blocks: { pos: number; text: string }[] = []

  state.doc.nodesBetween(from, to, (node, pos) => {
    if (!node.isTextblock) return
    blocks.push({ pos: pos + 1, text: node.textContent })
  })

  if (!blocks.length) return false

  let tr = state.tr
  // Always bottom-up so block start positions stay valid across edits.
  const ordered = [...blocks].sort((a, b) => b.pos - a.pos)

  for (const { pos: blockStart, text } of ordered) {
    const dash = parseDashLine(text)
    if (dash) {
      const next = indentDashLineText(text, outdent)
      if (next === text) continue
      if (outdent && dash.leading.length >= 2) {
        tr = tr.delete(blockStart, blockStart + 2)
      } else if (!outdent) {
        tr = tr.insertText('  ', blockStart)
      }
      continue
    }

    if (outdent) {
      if (text.startsWith('  ')) tr = tr.delete(blockStart, blockStart + 2)
      else if (text.startsWith('\t')) tr = tr.delete(blockStart, blockStart + 1)
    } else {
      tr = tr.insertText('  ', blockStart)
    }
  }

  editor.view.dispatch(tr)
  return true
}
