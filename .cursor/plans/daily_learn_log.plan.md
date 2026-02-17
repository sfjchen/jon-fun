---
name: ""
overview: ""
todos: []
isProject: false
---

# Daily Learn Log – Implementation Plan (updated)

## Context

- **Project**: README.md – Next.js Game Hub (sfjc.dev), Tailwind, TypeScript, Supabase. TMR uses localStorage; other features use Supabase.
- **Product**: One sentence (or more) per day, one entry per calendar day (edit/replace). localStorage + **Supabase backup** so site owner can view/save all logs from DB or admin page. Single user, multiple devices; no privacy notice.

---

## Data: localStorage + Supabase

### localStorage (unchanged)


| Key                   | Purpose                                   |
| --------------------- | ----------------------------------------- |
| `daily_learn_user_id` | UUID string, created once per browser     |
| `daily_learn_entries` | JSON array of `{ date, text, updatedAt }` |


- Submit: write to localStorage (upsert by date) **and** call API to sync to Supabase.
- History/Calendar/Analytics/Export in the app can keep using localStorage only (fast, works offline) or optionally merge with API data later.

### Supabase table: `daily_learn_entries`


| Column       | Type        | Notes                                                      |
| ------------ | ----------- | ---------------------------------------------------------- |
| `id`         | uuid        | Primary key, default `gen_random_uuid()`                   |
| `user_id`    | text        | UUID from browser localStorage (identifies device/browser) |
| `date`       | date        | `YYYY-MM-DD`, one row per user per day                     |
| `text`       | text        | Entry content                                              |
| `updated_at` | timestamptz | Set on insert/update                                       |


- **Unique constraint** on `(user_id, date)` so upsert is one row per user per day.
- RLS: can disable or allow all for now (single user). If you want only server/admin to write: use service role in API; anon can insert for the sync endpoint or use a simple secret.

---

## API

### `POST /api/daily-learn/entries`

- **Body**: `{ userId: string, date: string, text: string }` (date = `YYYY-MM-DD`).
- **Behavior**: Upsert into `daily_learn_entries` on `(user_id, date)`. Set `updated_at = now()`.
- **Response**: 200 + `{ ok: true }` or error.
- No auth for v1 (single user); optional later: check a shared secret header/query if you want to restrict who can write.

---

## Client (Daily Log app)

- **Submit flow**: On submit, (1) save to localStorage (upsert by date), (2) `fetch(POST /api/daily-learn/entries, { userId, date, text })`. Don’t block UI on API; optional: show “Saved locally” immediately and “Synced” when API returns.
- **Lib**: Keep `src/lib/dailyLearn.ts` as planned; add a small `syncEntryToServer(entry)` (or inline in component) that calls the API. Ensure `getOrCreateUserId()` is called before first submit so `userId` exists for the request.
- Rest of the app (Log / History / Calendar / Analytics / Export) unchanged; all read from localStorage.

---

## Admin: view and save all logs

You want **both** (1) use the DB directly and (2) use a small admin-only page.

### 1. Using the DB directly

- In **Supabase Dashboard** → Table Editor (or SQL), open `daily_learn_entries`. Query, sort, export as needed. No code.

### 2. Admin-only page

- **Route**: e.g. `/admin/daily-logs` (or `/daily-log/admin`).
- **Protection**: Check a secret that only you know. Simplest: env var `DAILY_LOG_ADMIN_SECRET`; page only renders list if e.g. `?key=SECRET` matches or a simple form submits the secret (then store in sessionStorage for that tab). No full auth needed.
- **Page content**:
  - Fetch all rows from `daily_learn_entries` (via API route that uses Supabase **service role** or a server-side read with RLS that allows read for a specific role). Order by `date desc`, then `updated_at desc`.
  - Display: table or list (user_id, date, text, updated_at).
  - **Save/export**: Buttons to “Download CSV”, “Download JSON”, “Copy all as text” (same format as the public export: e.g. `date: text` per line or JSON array).

### API for admin (read-only)

- `**GET /api/daily-learn/admin/entries`**
  - Query param or header: `key=DAILY_LOG_ADMIN_SECRET` (from env). If invalid, return 401.
  - If valid: query Supabase for all `daily_learn_entries`, return JSON array. Admin page calls this and then shows data and runs export in the browser.

---

## File changes (additions to original plan)

### Supabase

- **Migration**: New table `daily_learn_entries` with unique `(user_id, date)`. No RLS or RLS that allows insert for anon and select for service role only (admin uses API with secret).

### App

- `**src/app/api/daily-learn/entries/route.ts`**: POST handler, upsert `daily_learn_entries`.
- `**src/app/api/daily-learn/admin/entries/route.ts**`: GET handler, check `DAILY_LOG_ADMIN_SECRET`, return all entries.
- `**src/app/admin/daily-logs/page.tsx**`: Admin page (client or server): read secret from query/input; if valid, fetch from GET admin API, render table + export buttons (Download CSV/JSON, Copy text).
- `**src/lib/dailyLearn.ts**`: Add `syncEntryToServer(entry)` that POSTs to `/api/daily-learn/entries`.
- `**DailyLearnManager**`: On submit success (localStorage), call `syncEntryToServer({ date, text })` with `getOrCreateUserId()`.

### Env

- `**DAILY_LOG_ADMIN_SECRET**` (optional): Used to protect the admin page and GET admin API. If unset, admin route can be open (not recommended if site is ever public).

### README

- Document `daily_learn_entries` in Database Schema.
- Document `POST /api/daily-learn/entries` and `GET /api/daily-learn/admin/entries` in API Routes.
- Note env var `DAILY_LOG_ADMIN_SECRET` for admin.

---

## Summary


| Layer            | Behavior                                                                                                                                  |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **localStorage** | Primary write on submit; app reads from here for History/Calendar/Analytics/Export.                                                       |
| **Supabase**     | Every submit also upserted to `daily_learn_entries` (by user_id + date).                                                                  |
| **You (owner)**  | View/save all logs via (1) Supabase Dashboard or (2) Admin page at `/admin/daily-logs` (protected by secret) with export (CSV/JSON/copy). |


No privacy notice in the app (single user, your site).