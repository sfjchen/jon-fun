/**
 * Imports dated Fermi rounds from the public player into the publisher-edition archive.
 * Reads literal data from the publisher bundle without evaluating remote code.
 */
import { readFile } from 'node:fs/promises'
import ts from 'typescript'
import { siteDay, validDay } from '../src/lib/daily.ts'
import { savePublisherEdition } from '../src/lib/publisher-editions/local.ts'

const origin = 'https://fermi.gg/'
const [day = siteDay(), file] = process.argv.slice(2)
if (day !== 'archive' && !validDay(day)) throw new Error('Expected archive or YYYY-MM-DD')

/** Reads a successful response with a bounded wait. */
async function fetchText(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) })
  if (!response.ok) throw new Error('Fermi returned HTTP ' + response.status)
  return response.text()
}

/** Finds the question bank and dated schedule linked from the public game. */
async function publisherBundle() {
  const html = await fetchText(origin)
  const paths = [...new Set(html.match(/\.\/_app\/immutable\/chunks\/[\w-]+\.js/g))]
  for (let index = 0; index < paths.length; index += 4) {
    const chunks = await Promise.all(paths.slice(index, index + 4).map((path) => fetchText(new URL(path, origin))))
    const match = chunks.find(
      (chunk) => chunk.includes('dateStr:') && chunk.includes('prompt:') && chunk.includes('answer:'),
    )
    if (match) return match
  }
  throw new Error('Could not identify the current Fermi publisher format')
}

const source = ts.createSourceFile(
  'fermi.js',
  file ? await readFile(file, 'utf8') : await publisherBundle(),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.JS,
)
const questions = new Map()
const dates = new Map()

/** Collects question fields and the ordered IDs assigned to each published date. */
function visit(node) {
  if (ts.isObjectLiteralExpression(node)) {
    const props = Object.fromEntries(
      node.properties
        .filter(ts.isPropertyAssignment)
        .map((prop) => [prop.name.getText(source).replace(/^["']|["']$/g, ''), prop.initializer]),
    )
    if (props.id && props.prompt && props.answer && props.unit) {
      questions.set(props.id.text, {
        id: props.id.text,
        prompt: props.prompt.text,
        unit: props.unit.text,
        answer: Number(props.answer.text),
        source: props.source?.text,
        qualifier: props.qualifier?.text,
      })
    }
    if (props.dateStr && props.questions && ts.isArrayLiteralExpression(props.questions)) {
      const date = node.parent.name?.text
      if (validDay(date))
        dates.set(
          date,
          props.questions.elements.map((id) => id.text),
        )
    }
  }
  ts.forEachChild(node, visit)
}
visit(source)
const wanted = day === 'archive' ? [...dates.keys()].filter((date) => date <= siteDay()).sort() : [day]
if (!wanted.length) throw new Error('Empty schedule')
for (const date of wanted) {
  const ids = dates.get(date)
  if (!ids || ids.length !== 3) throw new Error('Missing Fermi edition for ' + date)
  const editionId = 1 + (Date.parse(date) - Date.parse('2026-07-27')) / 86400000
  await savePublisherEdition('fermi', date, {
    format: 'publisher-edition/v1',
    game: 'fermi',
    editionId,
    sourceDate: date,
    sourceUrl: origin,
    payload: { rounds: ids.map((id) => questions.get(id)) },
  })
}
console.log('Archived', wanted.length, 'Fermi editions from', wanted[0], 'through', wanted.at(-1))
