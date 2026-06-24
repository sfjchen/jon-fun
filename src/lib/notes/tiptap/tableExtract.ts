import type { Editor } from '@tiptap/core'
import type { Node as PmNode } from '@tiptap/pm/model'
import { gridToCsv } from './tableUtils'

function cellText(cell: PmNode): string {
  return cell.textContent.trim()
}

/** Walk the table at the current selection and return a 2D text grid. */
export function extractTableGrid(editor: Editor): string[][] | null {
  const { $from } = editor.state.selection
  let table: PmNode | null = null

  for (let d = $from.depth; d > 0; d--) {
    if ($from.node(d).type.name === 'table') {
      table = $from.node(d)
      break
    }
  }
  if (!table) return null

  const grid: string[][] = []
  table.forEach((row) => {
    if (row.type.name !== 'tableRow') return
    const cells: string[] = []
    row.forEach((cell) => {
      if (cell.type.name === 'tableCell' || cell.type.name === 'tableHeader') {
        cells.push(cellText(cell))
      }
    })
    if (cells.length) grid.push(cells)
  })
  return grid.length ? grid : null
}

export async function copyTableAsCsv(editor: Editor): Promise<boolean> {
  const grid = extractTableGrid(editor)
  if (!grid?.length) return false
  const csv = gridToCsv(grid)
  try {
    await navigator.clipboard.writeText(csv)
    return true
  } catch {
    return false
  }
}

export function tableCellCount(editor: Editor): { rows: number; cols: number } | null {
  const grid = extractTableGrid(editor)
  if (!grid?.length) return null
  const cols = Math.max(...grid.map((r) => r.length), 0)
  return { rows: grid.length, cols }
}
