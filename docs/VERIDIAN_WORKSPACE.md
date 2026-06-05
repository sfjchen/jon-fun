# Veridian workspace separation

**For AI agents:** Jon-fun hosts **three distinct products**. Never mix env vars, Supabase projects, remotes, or deploy targets across them.

## Three projects

| Project | Path | Git | Deploy | Supabase |
|---------|------|-----|--------|----------|
| **Jon-fun (Game Hub)** | `/Users/jchen04mac/Desktop/Jon-fun/` (parent) | `sfjchen/Jon-fun` | [sfjc.dev](https://sfjc.dev) (Vercel) | `nzviiorrlsdtwzvzodpg` (sfjchen personal) |
| **Veridian Whiteboard v1** | `Jon-fun/Veridian/` (nested) | `sfjchen/veridian-whiteboard` | [veridian-whiteboard.vercel.app](https://veridian-whiteboard.vercel.app) (+ `veridian.sfjc.dev` after DNS) | **None** in v1 |
| **Veridian EdTech (legacy)** | `/Users/jchen04mac/Desktop/Veridian/` | `sfjchen/Veridian` → fork of `VeridianTH/Veridian` | Render (Flask) + Vercel (Expo web) | `tpqasmpieyteutvdntda` (Jchen04 org) |

## Boundaries in this repo (Jon-fun)

- **`Veridian/`** is in parent `.gitignore` — parent git never tracks whiteboard files.
- Parent **`tsconfig.json`** and **`eslint.config.mjs`** exclude `Veridian/**` so `npm run build` on Jon-fun does not typecheck the nested app.
- **No Veridian routes** under parent `src/app/` — whiteboard is only in the nested repo.
- **Conventions flow one way:** Jon-fun README + `docs/DESIGN-SYSTEM.md` + changelog patterns → [`Veridian/WORKING.md`](../Veridian/WORKING.md). EdTech code on Desktop does **not** belong in `Jon-fun/Veridian/`.

## Environment files (never cross-pollinate)

| Project | Local env files | Required keys |
|---------|-----------------|---------------|
| Jon-fun | `.env.local` at repo root | `NEXT_PUBLIC_SUPABASE_*`, service keys for games/APIs, game-specific secrets |
| Whiteboard | `Jon-fun/Veridian/.env.local` | `OPENROUTER_API_KEY` (OCR + analysis + chat); optional `OPENAI_API_KEY` legacy OCR |
| EdTech | `Desktop/Veridian/{student,teacher}/{frontend,backend}/.env` | Supabase URL/anon/service, JWT, `EXPO_PUBLIC_BACKEND_URL`, etc. |

**Rules**

- Never commit `.env`, `.env.local`, or JWT secrets.
- Never point Jon-fun at `tpqasmpieyteutvdntda` unless explicitly migrating a Jon-fun feature (not planned).
- Whiteboard v1 has **no** `SUPABASE_*` — do not add Supabase to whiteboard without an explicit v2 scope change.

## Tools and ports (defaults)

| Tool | Jon-fun | Whiteboard | EdTech |
|------|---------|------------|--------|
| Dev server | `:3000` | `:3000` (run from `Veridian/` only — not alongside Jon-fun on same port) | Expo + Flask (separate) |
| Playwright | `PLAYWRIGHT_WEB_PORT=3001` | `PLAYWRIGHT_WEB_PORT=3011` | N/A (Expo) |
| Supabase CLI link | Parent `supabase/` → Jon-fun project | Not used | `Desktop/Veridian/supabase/` |

## Which codebase for new work?

- **Solo AI math whiteboard (Next.js, local-first):** `Jon-fun/Veridian/`
- **Classrooms, teacher dashboard, student Expo app:** `Desktop/Veridian/` only
- **Games, reader, wedding, party rooms:** parent Jon-fun `src/`

## Cursor / agent workflow

1. Confirm which of the three projects the task targets **before** editing.
2. Open the matching folder as the effective root (or `cd` there for commands).
3. Update the **correct** README changelog (`Jon-fun/README.md` vs `Veridian/README.md` vs `Desktop/Veridian` docs).
4. Run **`npm run build`** in the project you changed — not only the parent repo.
5. Do **not** `git push` from `Jon-fun/Veridian/` to `sfjchen/Veridian` without reading [`REMOTES.md`](../Veridian/REMOTES.md).

## Related docs

- [`Veridian/WORKING.md`](../Veridian/WORKING.md) — whiteboard agent standards (copied from Jon-fun style)
- [`Veridian/README.md`](../Veridian/README.md) — whiteboard scope and scripts
- `Desktop/Veridian/supabase/SUPABASE_JCHEN04.md` — EdTech Supabase setup (outside this repo)
