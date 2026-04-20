# Web reader benchmark rubric (2026)

Targets for qualitative comparison: **NovelFire**-style chapter readers, **Kobo Web Reader**, **Readwise Reader**, **BookFusion**, **Google Play Books** (uploads). Use this checklist when evaluating our e-reader (`/games/e-reader`) vs competitors and vs future iterations.

## Scoring

- **Pass**: Meets or exceeds typical competitor behavior for that row.
- **Partial**: Works but weaker (e.g. local-only vs cloud sync).
- **Fail**: Missing or unusable for the primary use case.

| Dimension | Pass criteria | Our reader baseline (snapshot) |
|-----------|----------------|----------------------------------|
| **Readability controls** | Font size, line height, paragraph spacing, width, themes, alignment; reduced-motion respected | Pass: sliders + themes + bionic + indent |
| **Navigation** | Prev/next chapter, TOC or chapter list, deep link to chapter | Pass: TOC, select, keyboard |
| **Progress** | Restore scroll position per chapter; survives reload | Partial→Pass: anchored location + scroll fallback |
| **Cross-device** | Optional sync of position (account or shared shelf) | Partial: communal books + optional `reading_state` sync |
| **Search** | In-book find with next/prev | Pass: lexical search |
| **Semantic search** | Optional query-aware ranking | Partial: embed API + optional re-rank when configured |
| **TTS** | Play/pause, rate, voice | Pass: `speechSynthesis` |
| **Annotations** | Highlights/notes (product readers) | Fail→roadmap: schema prepared via blocks |
| **PDF ingest** | Text PDF usable; scanned PDF detected / OCR path | Partial: reflow + scanned likelihood flag |
| **EPUB ingest** | Chapters + readable text | Pass: spine extract |
| **TXT ingest** | Chapter detection with confidence signal | Partial: heuristics + confidence metadata |
| **Performance** | Fast first readable paint; smooth scroll on long chapters | Partial: marks + lazy considerations |
| **Mobile** | Settings overlay, readable column | Pass: drawer + responsive |
| **Accessibility** | Focus order, shortcuts documented | Partial: shortcuts + focus rings |

## Heterogeneous “treatment” notes

- **Format (PDF vs EPUB vs TXT)**: Expect different pass rates on layout fidelity; PDF reflow is inherently lossy vs EPUB HTML.
- **Device**: Desktop benefits from side TOC; mobile relies on overlay settings—test both.
- **Communal backend**: With Supabase configured, library + reading state can sync; without, behavior should degrade to local-only without errors.

## References (external)

- Readium Web Publication Manifest (interoperable publication metadata).
- W3C Web Annotation Data Model (portable highlights, future).
