import type { Editor } from '@tiptap/core'
import { parseTodoLine } from '../shorthand'

/** Plain text with newline between blocks — used for trigger detection. */
export function plainTextFromEditor(editor: Editor): string {
  return editor.getText({ blockSeparator: '\n' })
}

/** Canonical storage format. */
export function markdownFromEditor(editor: Editor): string {
  return editor.getMarkdown()
}

/** Character offset in plain-text space (matches triggerParser line splitting). */
export function plainTextCursorOffset(editor: Editor): number {
  const pos = editor.state.selection.anchor
  return editor.state.doc.textBetween(0, pos, '\n', '\n').length
}

export function lineIndexAtPlainOffset(plain: string, offset: number): number {
  let line = 0
  const end = Math.min(offset, plain.length)
  for (let i = 0; i < end; i++) {
    if (plain[i] === '\n') line++
  }
  return line
}

export function lineIndexAtCursor(editor: Editor): number {
  const plain = plainTextFromEditor(editor)
  return lineIndexAtPlainOffset(plain, plainTextCursorOffset(editor))
}

export function selectedTextFromEditor(editor: Editor): string {
  const { from, to } = editor.state.selection
  if (from === to) return ''
  return editor.state.doc.textBetween(from, to, ' ')
}

/** Map plain-text char offset to ProseMirror document position. */
export function plainOffsetToDocPos(editor: Editor, target: number): number {
  const doc = editor.state.doc
  if (target <= 0) return 1

  let plain = 0

  for (let i = 0; i < doc.content.childCount; i++) {
    const block = doc.content.child(i)
    const blockText = block.textContent
    const blockEnd = plain + blockText.length

    if (target <= blockEnd) {
      const within = target - plain
      let walked = 0
      let found = block.type.name === 'paragraph' || block.type.name === 'heading' ? 1 : 0
      block.descendants((node, pos) => {
        if (node.isText) {
          const t = node.text ?? ''
          if (walked + t.length >= within) {
            found = pos + (within - walked)
            return false
          }
          walked += t.length
        }
        return true
      })
      if (found > 0) return found
      return plain + 1
    }

    plain = blockEnd + 1
  }

  return Math.max(1, doc.content.size - 1)
}

/** Scroll editor to a 0-based line index (plain-text lines). */
export function scrollToLineIndex(editor: Editor, lineIndex: number): void {
  const plain = plainTextFromEditor(editor)
  const lines = plain.split('\n')
  if (!lines.length) return

  const idx = Math.max(0, Math.min(lineIndex, lines.length - 1))
  let offset = 0
  for (let i = 0; i < idx; i++) offset += lines[i]!.length + 1

  const pos = plainOffsetToDocPos(editor, offset)
  editor.chain().focus().setTextSelection(pos).run()

  const dom = editor.view.domAtPos(pos)
  const el = dom.node instanceof HTMLElement ? dom.node : dom.node.parentElement
  el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
}

/** Escape `> todo` lines so markdown parser keeps them as paragraphs, not blockquotes. */
export function preprocessTodoMarkdown(md: string): string {
  return md
    .split('\n')
    .map((line) => {
      if (/^\s*>[^>]/.test(line) || /^\s*>\s/.test(line)) {
        return line.replace(/^(\s*)>/, '$1\\>')
      }
      return line
    })
    .join('\n')
}

/** Restore escaped todo markers after getMarkdown(). */
export function postprocessTodoMarkdown(md: string): string {
  return md.replace(/^(\s*)\\>/gm, '$1>')
}

/** Keep todo lines from plain text when markdown serializer drops markers. */
export function mergeTodoLinesIntoMarkdown(plain: string, md: string): string {
  const plainLines = plain.split('\n')
  const mdLines = md.split('\n')
  const max = Math.max(plainLines.length, mdLines.length)
  const out: string[] = []
  for (let i = 0; i < max; i++) {
    const p = plainLines[i] ?? ''
    const m = mdLines[i] ?? ''
    const merged = m || p
    if (parseTodoLine(p) && !parseTodoLine(merged)) out.push(p)
    else out.push(merged)
  }
  return out.join('\n')
}
