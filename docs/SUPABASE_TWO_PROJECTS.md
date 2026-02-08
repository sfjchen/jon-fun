# Using two Supabase projects (personal vs class)

## How contamination is avoided

- **App runtime**: Your app uses **one** project per deploy. That is set by env vars:
  - `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - In this repo, `.env.local` and Vercel point to **personal** (`nzviiorrlsdtwzvzodpg`).
- So **jon-fun (sfjc.dev) never talks to the class project**; no cross-project data flow.

- **Supabase MCP in Cursor**: The MCP server is linked to **one** project at a time (the one you connected when you set up the MCP). Whichever project that is gets used for `list_tables`, `apply_migration`, `execute_sql`, etc. The MCP does **not** switch projects by itself.

## Optional: Remove TMR from class project

The TMR migration was applied to the **class** project by mistake. Those tables are unused there and harmless. If you want them gone:

1. Open the **class** project: https://supabase.com/dashboard/project/ysfrxjztwprypybhsmcp
2. SQL Editor → New query → paste contents of **`supabase-cleanup-tmr-from-class-project.sql`** → Run

## Using MCP with both projects

You can have **two** MCP server entries (one per project) so the AI can work with either:

1. Open Cursor MCP config (e.g. **Cursor Settings → MCP** or the config file your setup uses).
2. Add two servers with different **names** and different **project_ref**:

```json
{
  "mcpServers": {
    "supabase-personal": {
      "url": "https://mcp.supabase.com/mcp?project_ref=nzviiorrlsdtwzvzodpg",
      "headers": { "Authorization": "Bearer YOUR_PERSONAL_ACCESS_TOKEN" }
    },
    "supabase-class": {
      "url": "https://mcp.supabase.com/mcp?project_ref=ysfrxjztwprypybhsmcp",
      "headers": { "Authorization": "Bearer YOUR_CLASS_ACCESS_TOKEN" }
    }
  }
}
```

(If you use a different auth flow, e.g. OAuth, the config will differ; the important part is two entries with two `project_ref` values.)

3. **Limitation**: Some Cursor versions route all Supabase tool calls to a single MCP server. If that happens, the workaround is to **temporarily disable** the project you are not using (comment out that entry) so the active one is the one you want.

4. **When working on jon-fun**: Prefer the **personal** project for migrations and SQL. Say so explicitly in chat (e.g. “use my personal Supabase project”) so the correct MCP server is used if both are configured.

## Summary

| What                | Personal (nzviiorrlsdtwzvzodpg)     | Class (ysfrxjztwprypybhsmcp)      |
|---------------------|--------------------------------------|-----------------------------------|
| jon-fun app / Vercel| Yes (via env vars)                   | No                                |
| TMR tables          | Run `supabase-migration-tmr-sessions.sql` here | Optional: run `supabase-cleanup-tmr-from-class-project.sql` to remove |
| MCP                 | Configure as one of the two servers  | Configure as the other server     |
