# Changelog

Running log of project work. Update this file when making significant changes.

## Format

- **YYYY-MM-DD**: Short description. (Details if needed.)

---

## 2025-02

### 1 Sentence Everyday
- Inline calendar + history on main page (removed separate pages)
- "(Resets 3am)" label; day resets at 3 AM local
- Renamed to "1 Sentence Everyday" (capital S, E)
- Fixed date display (UTC→local parsing)
- Edit previous entries from history + calendar
- Month navigation in calendar
- Supabase sync for cross-device backup

### Game24 Multiplayer
- Broadcast on game start for instant sync (~50–100ms)
- Broadcast on solve + round_finished when all players done
- 500ms polling fallback (silent) when waiting
- Fix Start Game button blinking
- Click outside cards/operators to deselect
- Final rankings show correct/total fraction (e.g. 3/8)
- playerCorrectCounts in GET rooms API

### Chwazi
- Touchscreen-only; message on non-touch devices

### Home Page
- TMR System + 1 Sentence Everyday as top 2 cards
- Card descriptions line-clamp-2 for uniform height
- Standardized "← Home" across games

### Docs
- CHANGELOG.md added
- README maintenance guidelines for AI agents
