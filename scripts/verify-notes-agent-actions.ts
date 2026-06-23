import { applyAgentActions, parseAgentResponse } from '../src/lib/notes/agentActions'
import type { NoteSession } from '../src/lib/notes/types'

const raw = `Updated MOIC in your dictionary.

---NOTES_ACTIONS---
[{"op":"dictionary.set","term":"MOIC","definition":"Multiple on invested capital."}]
---END---`

const { displayText, actions } = parseAgentResponse(raw)
if (!displayText.includes('Updated MOIC')) throw new Error('displayText strip failed')
if (actions.length !== 1 || actions[0]!.op !== 'dictionary.set') throw new Error('actions parse failed')

const session: NoteSession = {
  id: 's1',
  title: 'Old',
  notes: 'hello',
  tags: [],
  metadata: {},
  lookups: [],
  screenshots: {},
  startedAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

const applied = applyAgentActions(
  [
    { op: 'note.set_title', title: 'New title' },
    { op: 'note.add_tag', tag: 'IC' },
  ],
  session,
  'lk-1',
)
if (!applied.session || applied.session.title !== 'New title') throw new Error('note.set_title failed')
if (!applied.session.tags.includes('IC')) throw new Error('note.add_tag failed')

console.log('All agent action checks passed.')
