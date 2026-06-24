/** Tabular clipboard / CSV helpers for inline markdown tables. */

export const DEFAULT_TABLE_ROWS = 3
export const DEFAULT_TABLE_COLS = 3

function splitCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let q = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!
    if (c === '"') {
      q = !q
      continue
    }
    if (c === ',' && !q) {
      out.push(cur.trim())
      cur = ''
      continue
    }
    cur += c
  }
  out.push(cur.trim())
  return out
}

function splitLine(line: string): string[] {
  if (line.includes('\t')) return line.split('\t').map((c) => c.trim())
  if (line.includes(',')) return splitCsvLine(line)
  return [line.trim()]
}

/** True when plain text looks like a pasted spreadsheet (2+ rows, 2+ cols, uniform width). */
export function looksLikeTabularText(text: string): boolean {
  const lines = text
    .trim()
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.length > 0)
  if (lines.length < 2) return false

  const counts = lines.map((l) => splitLine(l).length)
  const cols = counts[0] ?? 0
  if (cols < 2) return false
  if (!counts.every((c) => c === cols)) return false

  // Pipe tables are handled by markdown parser — skip double-handling.
  if (/^\|/.test(lines[0]!) && lines.some((l) => /^\|[\s-:|]+\|/.test(l))) return false

  return true
}

export function parseTabularText(text: string): string[][] {
  return text
    .trim()
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.length > 0)
    .map(splitLine)
}

function escapeCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\n/g, ' ')
}

/** Build GFM pipe table markdown from a 2D grid (first row = header). */
export function gridToMarkdownTable(grid: string[][], withHeaderRow = true): string {
  if (!grid.length) return ''
  const cols = Math.max(...grid.map((r) => r.length), 1)
  const pad = (row: string[]) => {
    const out = [...row]
    while (out.length < cols) out.push('')
    return out.map((c) => escapeCell(c))
  }

  if (withHeaderRow && grid.length >= 1) {
    const [head, ...body] = grid
    const h = pad(head ?? [])
    const sep = h.map(() => '---')
    const rows = body.map(pad)
    return [
      `| ${h.join(' | ')} |`,
      `| ${sep.join(' | ')} |`,
      ...rows.map((r) => `| ${r.join(' | ')} |`),
    ].join('\n')
  }

  const rows = grid.map(pad)
  const sep = Array.from({ length: cols }, () => '---')
  return [`| ${sep.join(' | ')} |`, ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n')
}
