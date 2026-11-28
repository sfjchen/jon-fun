/**
 * Archives the publisher's Worldle, MapTap or Travle edition for the requested date.
 * Parses MapTap's public data declarations as literals and preserves its reveal and art data.
 */
import ts from 'typescript'
import { siteDay, validDay } from '../src/lib/daily.ts'
import { savePublisherEdition } from '../src/lib/publisher-editions/local.ts'

const [game, date = siteDay()] = process.argv.slice(2)
if (!validDay(date) || date > siteDay()) throw new Error('Expected a released YYYY-MM-DD')
const stamp = Date.parse(date)

/** Fetches a public source, checking HTTP status before parsing its body. */
async function read(url, json = true) {
  const r = await fetch(url, { signal: AbortSignal.timeout(20000) })
  if (!r.ok) throw new Error(url + ' returned HTTP ' + r.status)
  return json ? r.json() : r.text()
}

/** Decodes JSON-like JavaScript literals without evaluating publisher code. */
function literal(node) {
  if (ts.isArrayLiteralExpression(node)) return node.elements.map(literal)
  if (ts.isObjectLiteralExpression(node))
    return Object.fromEntries(
      node.properties.map((prop) => {
        if (!ts.isPropertyAssignment(prop)) throw new Error('Unexpected MapTap property')
        return [prop.name.text, literal(prop.initializer)]
      }),
    )
  if (ts.isStringLiteralLike(node)) return node.text
  if (ts.isNumericLiteral(node)) return Number(node.text)
  if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.MinusToken) return -literal(node.operand)
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false
  if (node.kind === ts.SyntaxKind.NullKeyword) return null
  throw new Error('Unknown MapTap value ' + ts.SyntaxKind[node.kind])
}

let sourceUrl, payload, editionId
switch (game) {
  case 'worldle': {
    sourceUrl = 'https://cdn-assets.teuteuf.fr/data/worldle/games/' + date.slice(0, 4) + '/' + date + '.json'
    payload = await read(sourceUrl)
    if (!/^[A-Z]{2}$/.test(payload.countryCode)) throw new Error('Worldle country missing')
    editionId = date
    break
  }
  case 'travle': {
    sourceUrl = 'https://travle.earth/'
    const html = await read(sourceUrl, false)
    const route = html.match(
      /gameID:"countries"[^{}]*route:\{start:"([A-Z0-9]{3})",target:"([A-Z0-9]{3})",dist:(\d+)\},hardMode:false,puzzleIx:(\d+)/,
    )
    if (!route || Number(route[4]) !== (stamp - Date.parse('2022-12-14')) / 86400000)
      throw new Error('Travle returned a different route date or format')
    editionId = Number(route[4])
    const adjacency = await read(sourceUrl + 'data/countries/adjacency.json')
    if (![route[1], route[2]].every((code) => Object.keys(adjacency).some((id) => id.split('#')[0] === code)))
      throw new Error('Missing Travle endpoint')
    payload = { start: route[1], target: route[2], distance: Number(route[3]), adjacency }
    break
  }
  case 'maptap': {
    const d = new Date(stamp)
    const key = d.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' }) + d.getUTCDate()
    sourceUrl = 'https://maptap.gg/data/this_day_in_history/' + key + '.js'
    const publisherScript = ts.createSourceFile('edition.js', await read(sourceUrl, false), ts.ScriptTarget.Latest)
    payload = {}
    for (const statement of publisherScript.statements) {
      const expr = statement.expression
      if (
        expr &&
        ts.isBinaryExpression(expr) &&
        expr.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
        ['cities', 'readOrder', 'globeOverlays'].includes(expr.left.text)
      )
        payload[expr.left.text] = literal(expr.right)
    }
    if (
      payload.readOrder?.length !== 5 ||
      new Set(payload.readOrder).size !== 5 ||
      !payload.readOrder.every(
        (id) =>
          id.startsWith(date + '-') &&
          payload.cities.some((city) => city.id === id && Number.isFinite(city.lat) && Number.isFinite(city.lng)),
      )
    )
      throw new Error('MapTap round dates, coordinates or order do not match')
    payload.scoring = await read('https://maptap.gg/data/scoring-config.json')
    editionId = (stamp - Date.parse('2024-06-21')) / 86400000
    break
  }
  default:
    throw new Error('Expected worldle, travle or maptap')
}
await savePublisherEdition(game, date, {
  format: 'publisher-edition/v1',
  game,
  sourceDate: date,
  sourceUrl,
  editionId,
  payload,
})
console.log(game, date, editionId)
