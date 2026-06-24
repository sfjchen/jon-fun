---
name: gh-git-github-workflow
description: >-
  Git commit/push after agent edits, and GitHub CLI (gh) for repos, issues, PRs,
  releases, Actions. Use when committing, pushing, deploying, or any git/GitHub work.
---
# Git & GitHub workflow (this repo + gh)

## Agent workflow — after substantive edits

**Default:** add → commit → push to `main` before ending the response (Vercel deploys sfjc.dev).

1. `git status` + `git diff` — review what changed
2. `git add` relevant files only (no `.env`, credentials, `log/`, `.DS_Store`)
3. `git commit` with HEREDOC message (why, not just what)
4. `git push origin HEAD`

One-liner if alias exists: `git acp -m "message"`.

**Skip commit when:** user says do not commit; ask/read-only mode; no file changes.

**Do not:** force-push `main`; commit secrets; amend pushed commits unless user requests and rules allow.

**Also update when relevant:** README changelog; feature agent docs (e.g. `docs/NOTES-AGENT.md`) when commands/paths change.

### Commit message (this repo)

- Work on **`main`** directly (no feature branches unless user asks)
- 1–2 sentences, focus on **why**
- After push: `npm run build` if unsure; confirm Vercel deploy if user cares

### Commit protocol (detailed)

```bash
git status --short
git diff --stat
git add <paths>
git commit -m "$(cat <<'EOF'
Your message here.

EOF
)"
git push origin HEAD
```

For PRs (when user asks): use `gh pr create` — see below.

---

## Quick Start (gh)

**Auth**: `gh auth login` or set `GITHUB_TOKEN` / `GH_TOKEN`.

**Repo context**: Run inside git repo, or `-R owner/repo` / `GH_REPO=owner/repo`.

## Core Commands by Domain

| Domain | Commands |
|--------|----------|
| **Repos** | `gh repo clone`, `create`, `fork`, `view`, `sync`, `edit` |
| **PRs** | `gh pr list`, `create`, `view`, `checkout`, `merge`, `review`, `comment`, `diff`, `checks` |
| **Issues** | `gh issue list`, `create`, `view`, `comment`, `close`, `edit`, `transfer`, `pin` |
| **Comments** | `gh pr comment`, `gh issue comment` (use `-b` or `-F file` for body) |
| **Releases** | `gh release create`, `list`, `view`, `download` |
| **Gists** | `gh gist create`, `list`, `view`, `edit`, `clone`, `delete` |
| **Actions** | `gh workflow run`, `list`, `view`; `gh run list`, `watch`, `view`, `download`; `gh cache list`, `delete` |
| **Secrets/Vars** | `gh secret set`, `list`; `gh variable set`, `list` |
| **Search** | `gh search repos`, `issues`, `prs`, `code` |
| **Browse** | `gh browse` (repo), `gh browse --wiki` (wiki), `gh pr view -w` (PR in browser) |

## Git + gh Best Practices

1. **Checkout PRs locally**: `gh pr checkout 123`
2. **Create PR/issue**: `gh pr create --title "..." --body "..."` or `--fill`
3. **Filter lists**: `gh pr list --state closed --assignee @me`
4. **Status**: `gh pr status`, `gh issue status`
5. **Browser**: `gh pr create --web`, `gh issue view 5 -w`

## Output Formatting

- **JSON**: `gh pr list --json number,title,state`
- **jq**: `gh pr list --json number,title --jq '.[] | "\(.number): \(.title)"'`

## Wiki

No native gh wiki commands — clone `https://github.com/owner/repo.wiki.git`, edit `.md`, push.

## Common Examples

```bash
gh repo clone owner/repo
gh pr create --fill
gh pr checkout 123
gh pr merge 123 --squash
gh issue create -t "Bug" -b "Description"
gh release create v1.0.0 --notes "Release notes"
gh workflow run ci.yml
gh run watch
```
