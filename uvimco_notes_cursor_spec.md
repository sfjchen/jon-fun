# UVIMCO AI Note Companion — Cursor Agent Spec
**Purpose:** Detailed build plan for a Cursor AI agent. No code yet — this is architecture, decisions, tradeoffs, and exact implementation instructions.

---

## 1. Problem Statement

A UVIMCO intern needs a single-screen note-taking workspace that:
- Lets them type raw, fast shorthand notes
- Automatically detects `?` triggers in real-time (per-word or per-line)
- Fires an AI call with full note context + any pasted screenshots
- Returns a concise answer in a persistent panel that supports follow-up
- Uses Lato font, minimal chrome, professional dark theme
- Runs entirely in-browser (no backend needed initially)

---

## 2. Key Design Decisions + Tradeoffs

### Decision 1: Editor Technology

| Option | Pros | Cons | Verdict |
|---|---|---|---|
| **Plain `<textarea>`** | Zero deps, simple | No syntax highlighting, no per-character decoration, hard to get cursor position for trigger detection | ❌ Too limited |
| **ContentEditable div** | Rich text possible | Notoriously buggy, cursor management nightmare, browser inconsistencies | ❌ Avoid |
| **CodeMirror 6** (`@uiw/react-codemirror`) | Per-character ViewPlugin triggers, custom decorations for shorthand colors, cursor position API, excellent React wrapper, stable & well-documented | Extra dependency, slight learning curve | ✅ **Chosen** |
| **Monaco Editor** | Full VS Code engine | 2MB+ bundle, overkill, no easy inline decoration for this use case | ❌ Too heavy |

**Use CodeMirror 6 via `@uiw/react-codemirror`.** It gives you ViewPlugin (character-by-character update hooks), custom decorations (colored underlines on `?terms`), and a clean onChange API.

---

### Decision 2: AI Response Display Location

This is the most important UX decision. Four options compared:

#### Option A: Inline Answer Inserted into Note Text
AI answer appears as a styled line directly below the `?` trigger in the editor.
```
boss: LTP overweight PE → ?basis risk flagged by IC
  ↳ 📌 basis risk: risk that hedged position drifts from benchmark...
>check DPI vs TVPI for fund III
```
- ✅ Answer stays with context permanently, notes become self-documenting
- ✅ No extra panel needed, full-width writing space
- ❌ Pollutes note content — hard to tell your notes from AI text on review
- ❌ Follow-up conversation is awkward to embed inline
- ❌ Notes become unclean for export
- **Verdict:** Good for a read-later glossary mode, bad for live conversation

#### Option B: Floating Popover Near Cursor
Small card floats near the `?` trigger position.
- ✅ Contextual, appears exactly where you're looking
- ✅ Lightweight, Esc to dismiss
- ❌ Obscures notes below the trigger
- ❌ Screen-edge collision (popover goes off-screen if `?` near bottom)
- ❌ Tiny space for follow-up — conversation thread doesn't fit
- ❌ Disappears on dismiss — no history
- ❌ CodeMirror cursor coordinate tracking adds implementation complexity
- **Verdict:** Good for single-term tooltip lookup, not for conversation

#### Option C: Persistent Right Sidebar (Chat Panel)
Fixed right panel (~320px) shows current Q&A and history.
- ✅ Natural conversation thread with follow-up
- ✅ Doesn't obscure any notes
- ✅ History of all lookups persists in session
- ✅ Clear visual separation of "my notes" vs "AI explanation"
- ✅ Collapsible with keyboard shortcut
- ❌ Reduces note editor width to ~65%
- ❌ Eyes must jump left→right during fast-paced meeting
- **Verdict:** Best for learning/follow-up use case. The gold standard (like Cursor's own AI panel).

#### Option D: Hybrid — Popover Expands to Sidebar
Tiny popover for simple answers, "thread →" button expands sidebar for follow-up.
- ✅ Least intrusive for simple lookups
- ✅ Full conversation available when needed
- ❌ Two interaction modes to learn
- ❌ More complex state (popover state + sidebar state)
- ❌ Sidebar slide-in animation can feel jarring during meeting
- **Verdict:** Clever but unnecessarily complex for intern's use case

### ✅ CHOSEN: Option C — Persistent Right Sidebar

**Reasoning:** The user explicitly wants follow-up questions. A UVIMCO intern is learning, not just glossary-hunting — they need to ask "wait but how does that relate to the LTP?" after the first answer. That needs a conversation thread. The 65/35 split is fine on a 13"+ laptop. Sidebar can be toggled with `Cmd+\` when the user wants full-width focus.

**One enhancement:** The `?term` in the notes gets a subtle amber underline decoration so you can always see which term the current sidebar answer is responding to.

---

### Decision 3: Trigger Timing

| Option | How | Tradeoff |
|---|---|---|
| **Auto on space** | Fire when user types space after `?word` | ✅ Seamless, zero extra keypress. Might fire if `?` typed accidentally — acceptable, sidebar just shows a result |
| **Auto on Enter** | Fire when line ends with `?` | Same — fires on Enter, which is natural |
| **Manual hotkey** | Cmd+Enter to process all `?` items | Batched, less interruption — but defeats the purpose of real-time |
| **Debounced auto** | Fire 500ms after last keystroke when `?` pattern detected | Catches mid-word pauses — but delay feels slow in a meeting |

### ✅ CHOSEN: Space-after-`?word` + Enter-after-`line?`

Clean, natural, zero extra keys. Two distinct trigger modes match the two use cases.

---

### Decision 4: `?` Disambiguation Logic

**Convention (as user described):**
- `?DPI` or `?basis risk` — question is about this specific term/phrase
- `LTP underweight this quarter?` — question is about the entire line

**Detection:**
- `?word trigger:` regex matches `\?(\w[\w\s]{0,40}?)` followed by a space/comma/newline. The content after `?` up to the first space is the term. For multi-word terms like `?basis risk`, the user finishes by hitting space after "risk" — but the trigger fires on the space after the first word... **Solution:** Buffer for 600ms after the `?` — if another word follows without a preceding space reaching 3+ chars, keep accumulating. Simpler alternative: `?` only captures to next space (single word), and user writes `?[basis risk]` with brackets for multi-word. **Recommended for simplicity: `?term` = single word, `?[multi word term]` = phrase.**
- `line? trigger:` current line ends with `?` when user presses Enter. The full line (minus trailing `?`) is the query.

---

### Decision 5: Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Framework | **Next.js 14 (App Router)** | Easy to set up, handles API routes cleanly if server-side needed later |
| Editor | **`@uiw/react-codemirror`** | Best CodeMirror 6 React wrapper |
| AI | **`@anthropic-ai/sdk`** with streaming | Streaming = tokens appear instantly, fast feeling |
| Font | **Lato** via Google Fonts | As specified |
| Styling | **Tailwind CSS** | Fast layout, easy responsive, works with Next.js |
| Storage | **`localStorage`** | Persist notes + glossary history in-browser |
| Screenshots | **Clipboard API + FileReader** | Base64 encode for Anthropic vision |
| State | **`useReducer` + `useContext`** | Sidebar state, note state, session state — no Zustand needed |

---

## 3. Full Layout Architecture

```
┌────────────────────────────────────────────────────────────────┐
│ HEADER  (48px)                                                 │
│ [🏛 UV] [Meeting Title input — editable] [date] [Cmd+\ panel] │
│ [export .md] [session: ● live]                                 │
├───────────────────────────────────────┬────────────────────────┤
│ NOTES PANEL  (flex: 1, min-w: 0)     │ AI PANEL  (320px)      │
│                                       │ collapsible via Cmd+\  │
│ ┌─────────────────────────────────┐   │ ┌────────────────────┐ │
│ │ SHORTHAND BAR  (32px, sticky)   │   │ │ PANEL HEADER       │ │
│ │ ?term  >action  *key  ~approx  │   │ │ "AI Lookup" [×]    │ │
│ └─────────────────────────────────┘   │ └────────────────────┘ │
│                                       │                        │
│ ┌─────────────────────────────────┐   │ ┌────────────────────┐ │
│ │ CODEMIRROR EDITOR               │   │ │ CURRENT Q&A        │ │
│ │                                 │   │ │                    │ │
│ │ boss: LTP overweight PE →       │   │ │ Q: basis risk      │ │
│ │ ?basis risk flagged by IC       │   │ │                    │ │
│ │ ═══════════ (amber underline)   │   │ │ A: The risk that a │ │
│ │                                 │   │ │ hedged position... │ │
│ │ >check DPI vs TVPI by friday    │   │ │ ▌ (streaming)      │ │
│ │ *key: GP conviction strong      │   │ └────────────────────┘ │
│ │ ~60bps drag from illiq prem     │   │                        │
│ │                                 │   │ ┌────────────────────┐ │
│ │ [📷 screenshot-1]               │   │ │ FOLLOW-UP INPUT    │ │
│ │                                 │   │ │ [Ask a follow-up ↵]│ │
│ │                                 │   │ └────────────────────┘ │
│ └─────────────────────────────────┘   │                        │
│                                       │ ── session history ──  │
│                                       │ ?DPI (2m ago)          │
│                                       │ ?LTP (5m ago)          │
│                                       │ line? (8m ago)         │
├───────────────────────────────────────┴────────────────────────┤
│ STATUSBAR  (28px)                                              │
│ [438 chars] [7 ?flags] [3 >actions]  [Cmd+K: decode all]     │
└────────────────────────────────────────────────────────────────┘
```

---

## 4. Component File Structure

```
uvimco-notes/
├── app/
│   ├── layout.tsx              ← Lato font import, global CSS
│   ├── page.tsx                ← Root: composes Header + WorkspaceLayout
│   └── globals.css             ← Tailwind + CSS vars (amber accent, dark theme)
├── components/
│   ├── WorkspaceLayout.tsx     ← flex row: NotePanel + AIPanel
│   ├── Header.tsx              ← title input, date, session indicator, export
│   ├── NoteEditor.tsx          ← CodeMirror 6 wrapper (main complexity here)
│   ├── ShorthandBar.tsx        ← sticky legend strip above editor
│   ├── AIPanel.tsx             ← sidebar: current Q&A + follow-up + history
│   ├── AnswerStream.tsx        ← renders streaming token-by-token answer
│   ├── HistoryList.tsx         ← collapsible list of past lookups this session
│   ├── StatusBar.tsx           ← char count, flag count, actions
│   └── ScreenshotThumb.tsx     ← inline image preview in editor area
├── lib/
│   ├── anthropic.ts            ← streaming API caller, system prompt builder
│   ├── triggerParser.ts        ← ?word and line? regex detection logic
│   ├── cmDecorations.ts        ← CodeMirror ViewPlugin + RangeSet for highlights
│   ├── noteStorage.ts          ← localStorage read/write helpers
│   └── imageHandler.ts         ← clipboard paste → base64 + state insertion
├── constants/
│   └── uvimcoContext.ts        ← UVIMCO system prompt, seed glossary (LTP, GP, etc.)
├── hooks/
│   ├── useAIPanel.ts           ← manages sidebar state, trigger dispatch
│   ├── useNoteSession.ts       ← note content, char count, screenshot map
│   └── useKeyboardShortcuts.ts ← Cmd+\, Cmd+K, Esc handlers
├── types/
│   └── index.ts                ← Lookup, SessionNote, Screenshot, TriggerType
└── package.json
```

---

## 5. Component Specs

### 5.1 NoteEditor.tsx
This is the most complex component. It owns:
- CodeMirror 6 instance
- Trigger detection via custom ViewPlugin
- Decoration application (amber underlines on `?` items)
- Paste event handler for screenshots

**Key props:**
```typescript
interface NoteEditorProps {
  value: string;
  onChange: (val: string) => void;
  onTrigger: (type: 'word' | 'line', query: string, context: string) => void;
  onScreenshotPaste: (id: string, base64: string, mimeType: string) => void;
  activeTriggerQuery: string | null; // which ?term is currently showing in sidebar
}
```

**Trigger detection logic (inside ViewPlugin.fromClass):**
```typescript
// On every docChanged event:
// 1. Get current line text and cursor position within line
// 2. WORD TRIGGER: regex match \?(\[[\w\s]+\]|\w+)\s on text before cursor
//    - If match found AND this is a NEW match (not same as last fired):
//    - Extract query = match[1] (strips ? and brackets if present)
//    - Extract context = last 15 lines of full document
//    - Debounce 400ms → call onTrigger('word', query, context)
// 3. LINE TRIGGER: check if this update was an Enter key press
//    - Get the PREVIOUS line (line above cursor after Enter)
//    - If it ends with '?' → extract line without '?'
//    - Call onTrigger('line', lineText, context) immediately (no debounce)
```

**Decoration logic (separate ViewPlugin):**
```typescript
// Scan full document for pattern: \?(\[[\w\s]+\]|\w+)
// For each match, apply a Decoration.mark({ class: 'cm-trigger-term' })
// CSS: .cm-trigger-term { border-bottom: 2px solid #D4A017; color: #F0C040; }
// Active term (currently showing in sidebar): add .cm-trigger-active class
// CSS: .cm-trigger-active { background: rgba(212,160,23,0.15); }
```

**Shorthand colorization (custom highlight extension):**
```typescript
// Use StreamLanguage.define or a simple Decoration-based approach:
// Lines starting with >  → amber left border + text color
// Lines starting with *  → bright white text
// Lines starting with ~  → muted/italic text
// ?word tokens          → amber underline (see above)
// Implementation: scan each visible line in updateListener, apply line decorations
```

**Screenshot paste handler:**
```typescript
// Attach to editor DOM element via editorRef.current.editor.dom.addEventListener('paste', ...)
// Check ClipboardEvent.clipboardData.items for image/* type
// FileReader.readAsDataURL() → base64
// Generate id: `screenshot-${Date.now()}`
// Call onScreenshotPaste(id, base64, mimeType)
// Parent inserts [📷 ${id}] text at cursor position via editor.dispatch()
```

---

### 5.2 AIPanel.tsx
Manages the sidebar. Three sub-sections:
1. **Current lookup** — question, streaming answer, status indicator
2. **Follow-up input** — text input, submits on Enter, appends to conversation thread
3. **History list** — collapsible, all lookups this session

**Props:**
```typescript
interface AIPanelProps {
  isOpen: boolean;
  currentLookup: Lookup | null;    // active Q&A
  history: Lookup[];               // past lookups
  isStreaming: boolean;
  onFollowUp: (question: string) => void;
  onSelectHistory: (lookup: Lookup) => void;
  onClose: () => void;
}
```

**Lookup type:**
```typescript
interface Lookup {
  id: string;
  type: 'word' | 'line';
  query: string;
  context: string;                 // notes context at time of trigger
  conversation: Message[];         // full Q&A thread for this lookup
  triggeredAt: Date;
  screenshots?: Screenshot[];      // attached images if any were in context
}
```

**Streaming display:** Use a `useRef` to accumulate tokens as they stream in. Render the accumulated string through a simple markdown renderer (bold, line breaks). Show a blinking cursor `▌` while streaming.

---

### 5.3 anthropic.ts — The AI Caller

**System prompt (injected on every call):**
```typescript
export const UVIMCO_SYSTEM = `You are a concise investment assistant for a new UVIMCO intern.

UVIMCO CONTEXT:
- University of Virginia Investment Management Company, ~$14.5B endowment
- Endowment model: ~58% alternatives (PE, VC, real estate, natural resources, absolute return)
- Invests through external GPs (general partners) — does not invest directly
- Key pool: LTP (Long Term Pool). Also manages STP (Short Term Pool)
- Benchmark: blended 75% MSCI ACWI + 25% Bloomberg US Treasury
- Internal terms: IC = Investment Committee, IPS = Investment Policy Statement, CIO = Chief Investment Officer

RESPONSE FORMAT:
- 2-4 sentences maximum for term lookups
- 3-5 sentences for line explanations
- Plain English, no jargon unless explained
- Start with the definition, then add one sentence of UVIMCO-specific context
- No bullet points — prose only
- If a screenshot is included, reference it naturally

Never say "Great question!" or add filler. Be direct.`;
```

**Streaming function:**
```typescript
export async function streamLookup({
  type,        // 'word' | 'line'
  query,       // the term or line text
  context,     // last 15 lines of notes
  conversation, // prior messages in this thread (for follow-up)
  screenshots, // base64 images currently in notes context
  onToken,     // callback per token: (token: string) => void
  onDone,      // callback when stream ends
}: StreamLookupParams): Promise<void> {
  
  const userMessage = buildUserMessage(type, query, context, screenshots);
  
  const messages: MessageParam[] = [
    ...conversation.map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: userMessage }
  ];
  
  const stream = await anthropic.messages.stream({
    model: 'claude-haiku-4-5-20251001',  // Use Haiku for speed on simple lookups
    max_tokens: 250,
    system: UVIMCO_SYSTEM,
    messages,
  });
  
  for await (const chunk of stream) {
    if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
      onToken(chunk.delta.text);
    }
  }
  onDone();
}
```

**Note on model choice:** Use `claude-haiku-4-5-20251001` for real-time lookups (fastest, cheapest). Use `claude-sonnet-4-6` for the "Decode All" full-session summary.

**Image inclusion in messages:**
```typescript
function buildUserMessage(type, query, context, screenshots): MessageParam['content'] {
  const content: ContentBlock[] = [];
  
  // Add any screenshots that appear in the recent note context
  for (const screenshot of screenshots) {
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: screenshot.mimeType, data: screenshot.base64 }
    });
  }
  
  const textPrompt = type === 'word'
    ? `In my UVIMCO meeting notes I encountered this term: "${query}"\n\nNote context (recent lines):\n${context}\n\nPlease explain "${query}" concisely in UVIMCO/endowment context.`
    : `In my UVIMCO meeting notes I wrote this line and marked it for explanation:\n"${query}"\n\nNote context:\n${context}\n\nPlease explain what this means in UVIMCO context.`;
  
  content.push({ type: 'text', text: textPrompt });
  return content;
}
```

---

### 5.4 triggerParser.ts

```typescript
export interface TriggerResult {
  type: 'word' | 'line';
  query: string;
  matchStart: number;  // char offset in document for decoration
  matchEnd: number;
}

// Called from CodeMirror ViewPlugin on every docChanged
export function detectTriggers(
  fullText: string,
  cursorPos: number,
  lastFiredQuery: string | null
): TriggerResult | null {
  
  const lines = fullText.split('\n');
  let charCount = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineStart = charCount;
    const lineEnd = charCount + line.length;
    
    // Check if cursor is on this line
    if (cursorPos >= lineStart && cursorPos <= lineEnd + 1) {
      const cursorInLine = cursorPos - lineStart;
      const textBeforeCursor = line.slice(0, cursorInLine);
      
      // WORD TRIGGER: ?word or ?[multi word] followed by space
      // Single word: ?DPI<space>
      const wordMatch = textBeforeCursor.match(/\?(\w+)\s$/);
      // Multi-word bracket: ?[basis risk]<space>
      const phraseMatch = textBeforeCursor.match(/\?\[([^\]]+)\]\s$/);
      
      const match = phraseMatch || wordMatch;
      if (match && match[1] !== lastFiredQuery) {
        const query = match[1];
        const matchStr = phraseMatch ? `?[${query}]` : `?${query}`;
        const matchStart = lineStart + textBeforeCursor.lastIndexOf(matchStr);
        return {
          type: 'word',
          query,
          matchStart,
          matchEnd: matchStart + matchStr.length,
        };
      }
      
      // LINE TRIGGER: cursor just moved to a new line, previous line ends with ?
      if (i > 0 && cursorInLine === 0) {
        const prevLine = lines[i - 1];
        if (prevLine.trim().endsWith('?') && prevLine.trim().length > 1) {
          const query = prevLine.trim().slice(0, -1).trim();
          if (query !== lastFiredQuery) {
            return { type: 'line', query, matchStart: lineStart - prevLine.length - 1, matchEnd: lineStart - 1 };
          }
        }
      }
    }
    
    charCount += line.length + 1; // +1 for newline
  }
  
  return null;
}

// Get context: last N lines up to cursor
export function getContext(fullText: string, cursorPos: number, lines = 15): string {
  const allLines = fullText.slice(0, cursorPos).split('\n');
  return allLines.slice(-lines).join('\n');
}
```

---

## 6. State Management

Use a `useReducer` at the `WorkspaceLayout` level:

```typescript
interface AppState {
  notes: string;                        // raw editor content
  screenshots: Record<string, Screenshot>; // id → base64
  aiPanel: {
    isOpen: boolean;
    currentLookup: Lookup | null;
    isStreaming: boolean;
    streamBuffer: string;               // accumulates as tokens arrive
    history: Lookup[];
  };
  session: {
    title: string;
    startedAt: Date;
  };
}

type Action =
  | { type: 'NOTES_CHANGE'; payload: string }
  | { type: 'TRIGGER_FIRED'; payload: { type: 'word'|'line'; query: string; context: string } }
  | { type: 'STREAM_TOKEN'; payload: string }
  | { type: 'STREAM_DONE' }
  | { type: 'FOLLOW_UP'; payload: string }
  | { type: 'SCREENSHOT_ADD'; payload: Screenshot }
  | { type: 'PANEL_TOGGLE' }
  | { type: 'HISTORY_SELECT'; payload: Lookup }
  | { type: 'SESSION_TITLE_CHANGE'; payload: string };
```

---

## 7. Styling Spec

**Font:** `@import url('https://fonts.googleapis.com/css2?family=Lato:wght@300;400;700&display=swap');`

Apply globally: `body { font-family: 'Lato', sans-serif; }`

**Color tokens (in globals.css as CSS custom properties):**
```css
:root {
  --bg-base:        #0D1117;
  --bg-elevated:    #161B22;
  --bg-panel:       #1C2128;
  --accent:         #D4A017;      /* amber — UVA palette nod */
  --accent-dim:     rgba(212, 160, 23, 0.12);
  --accent-strong:  #F0C040;
  --text-primary:   #E6EDF3;
  --text-secondary: #8B949E;
  --text-muted:     #484F58;
  --border:         #30363D;
  --border-hover:   #484F58;
  --action-color:   #D4A017;      /* > action items */
  --key-color:      #E6EDF3;      /* * key points */
  --approx-color:   #6E7681;      /* ~ approximate */
  --trigger-color:  #D4A017;      /* ?term underline */
}
```

**CodeMirror theme overrides:**
```css
.cm-editor { background: var(--bg-elevated) !important; }
.cm-content { font-family: 'Lato', sans-serif !important; font-size: 14px; line-height: 1.8; }
.cm-line { padding: 0 16px; }
.cm-trigger-term { border-bottom: 2px solid var(--accent); color: var(--accent-strong); cursor: help; }
.cm-trigger-active { background: var(--accent-dim); border-radius: 3px; }
.cm-action-line { color: var(--action-color); }
.cm-key-line { color: var(--key-color); font-weight: 700; }
.cm-approx-line { color: var(--approx-color); font-style: italic; }
```

---

## 8. Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Cmd+\` | Toggle AI sidebar open/closed |
| `Cmd+K` | Decode all notes (full session summary, uses Sonnet) |
| `Esc` | Dismiss current lookup (clear sidebar current Q&A) |
| `Enter` in follow-up input | Submit follow-up question |
| `Cmd+S` | Export notes as .md file |
| `Cmd+Z` | Standard undo in editor |

---

## 9. Note Export Format

When user hits Cmd+S or the export button, generate a `.md` file:

```markdown
# Meeting Notes — UVIMCO
Date: June 22, 2026
Session: [user-entered title]

---

## Raw Notes
[full raw note text, shorthand preserved]

---

## AI Lookups This Session
**?basis risk** — basis risk is the risk that a hedged position...
**?DPI** — DPI (Distributed to Paid-In) is...
[etc.]

---

## Action Items
[all lines that started with >]
```

---

## 10. Implementation Order for Cursor Agent

Build in this exact sequence — each step is independently testable:

**Phase 1: Shell (1-2 hours)**
1. `npx create-next-app@latest uvimco-notes --typescript --tailwind --app`
2. Install: `@uiw/react-codemirror @anthropic-ai/sdk`
3. Add Lato to `layout.tsx` via Google Fonts link
4. Create `globals.css` with all CSS variables above
5. Scaffold `WorkspaceLayout.tsx` as static flex row (hardcoded widths)
6. Add `Header.tsx` stub with title input
7. Add `StatusBar.tsx` stub

**Phase 2: Editor (2-3 hours)**
8. Implement `NoteEditor.tsx` with basic CodeMirror 6 (no extensions yet)
9. Add shorthand colorization decorations (lines starting with `>`, `*`, `~`)
10. Implement `triggerParser.ts` functions — unit test these independently
11. Add trigger detection ViewPlugin to CodeMirror
12. Add `?term` underline decorations on detected triggers
13. Implement screenshot paste handler + `ScreenshotThumb.tsx`

**Phase 3: AI Panel (2-3 hours)**
14. Implement `anthropic.ts` with streaming function
15. Build `AIPanel.tsx` with static layout (placeholder content)
16. Build `AnswerStream.tsx` component
17. Wire trigger dispatch from `NoteEditor` → `useAIPanel` hook → streaming call
18. Wire follow-up input to append to conversation history

**Phase 4: State + Polish (1-2 hours)**
19. Implement `useReducer` app state
20. Add `noteStorage.ts` localStorage persistence
21. Implement `Cmd+K` decode-all with Sonnet
22. Implement `Cmd+\` sidebar toggle with CSS transition
23. Add export function
24. Final CSS polish — spacing, transitions, scrollbars

---

## 11. Critical Implementation Notes

**Anthropic API key:** The `@anthropic-ai/sdk` will try to read `process.env.ANTHROPIC_API_KEY`. In Next.js App Router, do NOT call the SDK from client components — create a Route Handler at `app/api/lookup/route.ts` that proxies the request. Pass `stream: true` and use `Response` with a `ReadableStream` to pipe tokens to the client. The client uses `fetch` with a reader loop.

**Alternative (simpler for prototype):** Use the same `fetch` direct-to-API approach from the previous artifact — it works in-browser. But note: this exposes the API key in the client. For production, use the Route Handler pattern.

**CodeMirror in Next.js:** Add `'use client'` to `NoteEditor.tsx`. CodeMirror requires the browser DOM and will throw on SSR. Also add `ssr: false` dynamic import if you see SSR errors.

**Streaming and React state:** Do NOT call `setState` on every token — this causes excessive re-renders. Instead, accumulate tokens in a `useRef`, and use `requestAnimationFrame` or a 50ms interval to batch-commit the accumulated string to state for display.

**`?` false positive prevention:** Only fire the trigger if the `?` is the first character of a word (not mid-word). Filter with: `textBeforeCursor.match(/(?:^|\s)\?(\w+)\s$/)` — the `(?:^|\s)` ensures `?` was preceded by space or line start.

**Prevent double-firing:** Store the last-fired query in a ref (`lastFiredRef`). Skip the trigger if `query === lastFiredRef.current`. Reset `lastFiredRef` when notes change significantly (user deletes the line).

---

## 12. Future Enhancements (out of scope for initial build)

- **Saved glossary:** Auto-extract all Q&A from session to a persistent JSON glossary — next session pre-populates context with prior lookups
- **Multi-session history:** Sidebar "past sessions" section for reviewing old meetings
- **`?` hover tooltip:** On hover over any `?term` that was already looked up, show a small tooltip with cached answer — no new API call
- **Voice mode:** Web Speech API for dictation mode when hands are needed elsewhere
- **Team glossary:** Export + import a shared UVIMCO team glossary JSON to pre-seed context
- **Decode All:** `Cmd+K` full session summary already specced — extend it to also identify "things to research" from the session

---

*End of spec. Hand this document to Cursor agent with instruction: "Build this step by step starting from Phase 1. Ask me before starting each phase."*
