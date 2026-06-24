import {
  gridToMarkdownTable,
  looksLikeTabularText,
  parseTabularText,
} from '../src/lib/notes/tiptap/tableUtils'

let failed = 0

function ok(name: string, cond: boolean) {
  if (cond) console.log(`✓ ${name}`)
  else {
    console.error(`✗ ${name}`)
    failed++
  }
}

const tsv = 'Ticker\tPrice\nAAPL\t190\nMSFT\t420'
ok('detects tab-separated paste', looksLikeTabularText(tsv))
ok('rejects single line', !looksLikeTabularText('one line only'))
ok('rejects uneven rows', !looksLikeTabularText('a,b\nonly'))

const csv = 'Ticker,Price\nAAPL,190\nMSFT,420'
ok('detects csv paste', looksLikeTabularText(csv))

const pipeMd = '| A | B |\n| --- | --- |\n| 1 | 2 |'
ok('skips existing pipe table', !looksLikeTabularText(pipeMd))

const grid = parseTabularText(tsv)
ok('parses 3 rows', grid.length === 3)
ok('parses 2 cols', grid[0]?.length === 2)
ok('parses ticker', grid[1]?.[0] === 'AAPL')

const md = gridToMarkdownTable(grid, true)
ok('markdown has header', md.includes('| Ticker | Price |'))
ok('markdown has separator', md.includes('| --- |'))
ok('markdown has data row', md.includes('| AAPL | 190 |'))

const roundGrid = parseTabularText(csv)
const md2 = gridToMarkdownTable(roundGrid, true)
ok('csv grid to md', md2.includes('MSFT'))

if (failed > 0) {
  console.error(`\n${failed} check(s) failed.`)
  process.exit(1)
}
console.log('\nAll table helper checks passed.')
