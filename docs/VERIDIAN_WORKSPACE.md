# Veridian workspace separation

**For AI agents:** Jon-fun hosts **three distinct products**. Never mix env vars, Supabase projects, remotes, or deploy targets across them.

## Canonical demo URL

| URL | Product | Use |
|-----|---------|-----|
| **[sfjc.dev/veridian](https://sfjc.dev/veridian)** | Next.js whiteboard (`Jon-fun/Veridian/`) | **Default** — solo demo, no login, local-first, OpenRouter AI |
| `www.veridian.fyi` / `veridian-student.vercel.app` | Expo EdTech (`Desktop/Veridian/`) | Legacy — redirects to sfjc.dev/veridian; classroom/Supabase path only |

When the user says “Veridian whiteboard” or “my demo”, they mean **sfjc.dev/veridian**, not `veridian.fyi/document/default-algebra`.

**Grading video:** `Jon-fun/Veridian/docs/VIDEO_DEMO_RUBRIC.md` — Q1–Q4 script; live take at [sfjc.dev/veridian?demo=1](https://sfjc.dev/veridian?demo=1).

**Agents:** After whiteboard code changes, always **push → `vercel --prod` → `npm run smoke:deploy`** in `Jon-fun/Veridian/` (see `Veridian/WORKING.md`).

## Three projects

| Project | Path | Git | Deploy | Supabase |
|---------|------|-----|--------|----------|
| **Jon-fun (Game Hub)** | `/Users/jchen04mac/Desktop/Jon-fun/` (parent) | `sfjchen/Jon-fun` | [sfjc.dev](https://sfjc.dev) (Vercel) | `nzviiorrlsdtwzvzodpg` (sfjchen personal) |
| **Veridian Whiteboard v1** | `Jon-fun/Veridian/` (nested) | `sfjchen/veridian-whiteboard` | [sfjc.dev/veridian](https://sfjc.dev/veridian) (rewrite → `veridian-whiteboard` origin) | **None** in v1 |
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

- **Solo AI math whiteboard (Next.js, local-first):** `Jon-fun/Veridian/` → deploy **`sfjc.dev/veridian`**
- **Classrooms, teacher dashboard, student Expo app:** `Desktop/Veridian/` only (not the public demo)
- **Games, reader, party rooms:** parent Jon-fun `src/`

## How sfjc.dev/veridian is wired

Jon-fun `next.config.mjs` rewrites `/veridian` → `VERIDIAN_ORIGIN` (default `veridian-whiteboard.vercel.app`). The standalone app sets `basePath: '/veridian'` in `Veridian/next.config.mjs`. Home grid links to `/veridian` on [sfjc.dev](https://sfjc.dev).

## Cursor / agent workflow

1. Confirm which of the three projects the task targets **before** editing.
2. Open the matching folder as the effective root (or `cd` there for commands).
3. Update the **correct** README changelog (`Jon-fun/README.md` vs `Veridian/README.md` vs `Desktop/Veridian` docs).
4. Run **`npm run build`** in the project you changed — not only the parent repo.
5. Do **not** `git push` from `Jon-fun/Veridian/` to `sfjchen/Veridian` without reading [`REMOTES.md`](../Veridian/REMOTES.md).

## Multi-agent / parallel Cursor chats

Several chats may run at once (EdTech deploy, whiteboard refactor, Jon-fun hub). **Reconcile before editing:**

| If the task mentions… | Work in… | Deploy target |
|------------------------|----------|---------------|
| Whiteboard, demo, sfjc.dev/veridian, no login | `Jon-fun/Veridian/` | `veridian-whiteboard` Vercel → sfjc.dev path |
| Classrooms, teacher, Expo, Supabase, Render | `Desktop/Veridian/` | Legacy EdTech; **public demo redirects** to sfjc.dev/veridian |
| Games, reader, party rooms | Jon-fun parent `src/` | sfjc.dev root |

### Merged intent (Jun 2026 — reconcile parallel chats)

| Topic | Canonical choice |
|-------|------------------|
| **Demo URL** | [sfjc.dev/veridian](https://sfjc.dev/veridian) — `www.veridian.fyi` redirects here |
| **Whiteboard stack** | Next.js + Vercel API routes + OpenRouter — **no Render, no Supabase** |
| **EdTech stack** | `Desktop/Veridian/` Expo + Flask + Render **kz5l** + Supabase `tpqasmpieyteutvdntda` |
| **Git remotes** | Whiteboard → `sfjchen/veridian-whiteboard`; EdTech → `sfjchen/Veridian` |
| **AI keys** | Whiteboard: OpenRouter on Vercel; EdTech: OpenRouter on Render |
| **CTA** | **Analyze work** (rubric); demo URL `?demo=1` |
| **Design** | Original Veridian org (green/forest) — not Jon-fun notebook |

Parent chats: [whiteboard refactor](00724d07-e8db-4584-95ed-e8f3e08ee861), [EdTech deploy](49e1039d-1be7-483f-bb6a-491cadd90833), [separation + rubric](623283fa-7519-4152-bf9c-d7e69fa828ad).

**Common agent mistakes**

- Wiring whiteboard to Render Flask — **not needed**; whiteboard AI is Vercel-only.
- Adding Supabase/auth to whiteboard v1 — **out of scope** unless user explicitly requests v2.
- Using Jon-fun ink/notebook design on whiteboard — user wants **original Veridian org** styling.
- Pushing whiteboard commits to `sfjchen/Veridian` — use `sfjchen/veridian-whiteboard`.
- Running Jon-fun `npm run build` and failing on nested Playwright — parent must exclude `Veridian/**` (see `tsconfig.json`, `eslint.config.mjs`).

## Related docs

- [`Veridian/WORKING.md`](../Veridian/WORKING.md) — whiteboard agent standards (copied from Jon-fun style)
- [`Veridian/README.md`](../Veridian/README.md) — whiteboard scope and scripts
- `Desktop/Veridian/supabase/SUPABASE_JCHEN04.md` — EdTech Supabase setup (outside this repo)
