import { deleteDictionaryEntry, upsertManualEntry } from './glossary'
import type { NoteSession } from './types'

const ACTIONS_START = '---NOTES_ACTIONS---'
const ACTIONS_END = '---END---'

export type AgentAction =
  | { op: 'dictionary.set'; term: string; definition: string }
  | { op: 'dictionary.delete'; term: string }
  | { op: 'note.set_title'; title: string }
  | { op: 'note.set_body'; body: string }
  | { op: 'note.append_body'; text: string }
  | { op: 'note.set_tags'; tags: string[] }
  | { op: 'note.add_tag'; tag: string }
  | { op: 'note.remove_tag'; tag: string }

export type AgentApplyResult = {
  session: NoteSession | null
  dictionaryChanged: boolean
  applied: string[]
}

export function parseAgentResponse(raw: string): { displayText: string; actions: AgentAction[] } {
  const start = raw.indexOf(ACTIONS_START)
  if (start < 0) return { displayText: raw.trim(), actions: [] }

  const end = raw.indexOf(ACTIONS_END, start)
  const displayText = raw.slice(0, start).trim()
  const block = end > start ? raw.slice(start + ACTIONS_START.length, end).trim() : raw.slice(start + ACTIONS_START.length).trim()

  let actions: AgentAction[] = []
  try {
    const parsed = JSON.parse(block) as unknown
    if (Array.isArray(parsed)) actions = parsed.filter(isAgentAction)
  } catch {
    /* ignore malformed actions */
  }
  return { displayText, actions }
}

function isAgentAction(v: unknown): v is AgentAction {
  if (!v || typeof v !== 'object') return false
  const op = (v as { op?: string }).op
  if (op === 'dictionary.set') {
    const x = v as { term?: string; definition?: string }
    return Boolean(x.term?.trim() && x.definition?.trim())
  }
  if (op === 'dictionary.delete') return Boolean((v as { term?: string }).term?.trim())
  if (op === 'note.set_title') return Boolean((v as { title?: string }).title?.trim())
  if (op === 'note.set_body') return typeof (v as { body?: string }).body === 'string'
  if (op === 'note.append_body') return Boolean((v as { text?: string }).text?.trim())
  if (op === 'note.set_tags') return Array.isArray((v as { tags?: unknown }).tags)
  if (op === 'note.add_tag' || op === 'note.remove_tag') return Boolean((v as { tag?: string }).tag?.trim())
  return false
}

export function applyAgentActions(
  actions: AgentAction[],
  session: NoteSession,
  lookupId: string,
): AgentApplyResult {
  if (!actions.length) return { session: null, dictionaryChanged: false, applied: [] }

  let next: NoteSession = { ...session }
  let dictionaryChanged = false
  const applied: string[] = []

  for (const action of actions) {
    switch (action.op) {
      case 'dictionary.set':
        upsertManualEntry(action.term, action.definition, session.id, lookupId)
        dictionaryChanged = true
        applied.push(`dictionary: ${action.term}`)
        break
      case 'dictionary.delete':
        if (deleteDictionaryEntry(action.term)) {
          dictionaryChanged = true
          applied.push(`deleted dictionary: ${action.term}`)
        }
        break
      case 'note.set_title':
        next = { ...next, title: action.title.trim().slice(0, 120) }
        applied.push('note title')
        break
      case 'note.set_body':
        next = { ...next, notes: action.body }
        applied.push('note body')
        break
      case 'note.append_body':
        next = { ...next, notes: next.notes ? `${next.notes}\n${action.text}` : action.text }
        applied.push('note append')
        break
      case 'note.set_tags':
        next = { ...next, tags: action.tags.map((t) => t.trim()).filter(Boolean).slice(0, 20) }
        applied.push('note tags')
        break
      case 'note.add_tag': {
        const tag = action.tag.trim()
        if (tag && !next.tags.includes(tag)) next = { ...next, tags: [...next.tags, tag] }
        applied.push(`tag +${tag}`)
        break
      }
      case 'note.remove_tag':
        next = { ...next, tags: next.tags.filter((t) => t.toLowerCase() !== action.tag.trim().toLowerCase()) }
        applied.push(`tag -${action.tag}`)
        break
    }
  }

  const sessionChanged =
    next.title !== session.title ||
    next.notes !== session.notes ||
    JSON.stringify(next.tags) !== JSON.stringify(session.tags)

  return {
    session: sessionChanged ? { ...next, updatedAt: new Date().toISOString() } : null,
    dictionaryChanged,
    applied,
  }
}

export const AGENT_ACTIONS_FOOTER = `
When the user asks you to change their note or dictionary, append this block AFTER your reply (user never sees it if parsed correctly):

${ACTIONS_START}
[{"op":"dictionary.set","term":"Example","definition":"Short definition"}]
${ACTIONS_END}

Allowed ops:
- dictionary.set {term, definition}
- dictionary.delete {term}
- note.set_title {title}
- note.set_body {body} — full markdown/plain note text
- note.append_body {text} — append lines
- note.set_tags {tags: string[]}
- note.add_tag {tag}
- note.remove_tag {tag}

Only include actions when the user wants data changed or explicitly asks you to update/store something. JSON array only inside the block.`
