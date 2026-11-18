import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseCommunalPublicationBody } from '../src/lib/reader/communal-server'
import { defaultReaderPreferences, loadReaderPreferences, saveReaderPreferences } from '../src/lib/reader/settings'

function publication(block: Record<string, unknown>) {
  return {
    id: 'format-test', title: 'Format test', sourceType: 'epub', createdAt: '2026-01-01', updatedAt: '2026-01-01',
    chapters: [{ id: 'one', title: 'One', order: 0, wordCount: 2, paragraphs: ['Original text'], blocks: [{ id: 'one-p0', kind: 'paragraph', text: 'Original text', ...block }] }],
  }
}

test('rejects formatting that could change text or load unsafe illustrations', () => {
  assert.throws(() => parseCommunalPublicationBody(publication({ text: 'Changed text' })))
  assert.throws(() => parseCommunalPublicationBody(publication({ runs: [{ text: 'Dropped original words' }] })))
  assert.throws(() => parseCommunalPublicationBody(publication({ kind: 'image', image: { src: 'https://tracking.example/image', alt: 'Remote' } })))
  assert.throws(() => parseCommunalPublicationBody(publication({ kind: 'image', image: { src: 'data:image/svg+xml;base64,PHN2Zz4=', alt: 'Active content' } })))
  assert.doesNotThrow(() => parseCommunalPublicationBody(publication({ runs: [{ text: 'Original ', italic: true }, { text: 'text', bold: true }] })))
})

test('updates legacy reading defaults once and retains customized preferences', () => {
  const storage = new Map<string, string>()
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  } } })
  try {
    storage.set('reader:v1:prefs', JSON.stringify({ ...defaultReaderPreferences, fontSize: 19, paragraphGap: 28, maxWidth: 980, panelOpen: true }))
    const migrated = loadReaderPreferences()
    assert.equal(migrated.maxWidth, 760)
    assert.equal(migrated.panelOpen, false)
    saveReaderPreferences({ ...migrated, fontSize: 23, maxWidth: 680, panelOpen: true })
    assert.equal(loadReaderPreferences().fontSize, 23)
    assert.equal(loadReaderPreferences().maxWidth, 680)
    assert.equal(loadReaderPreferences().panelOpen, true)
  } finally {
    Reflect.deleteProperty(globalThis, 'window')
  }
})
