import type { Editor } from '@tiptap/core'

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

/** Add or remove two leading spaces on each block in the selection. */
export function indentBlocks(editor: Editor, outdent = false): boolean {
  const { state } = editor
  const { from, to } = state.selection
  const blocks: number[] = []

  state.doc.nodesBetween(from, to, (node, pos) => {
    if (node.isTextblock) blocks.push(pos + 1)
  })

  if (!blocks.length) return false

  let tr = state.tr
  const ordered = [...blocks].sort((a, b) => (outdent ? a - b : b - a))

  for (const insertPos of ordered) {
    const $pos = tr.doc.resolve(insertPos)
    const block = $pos.parent
    if (!block.isTextblock) continue
    const blockStart = insertPos
    const text = block.textContent

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
