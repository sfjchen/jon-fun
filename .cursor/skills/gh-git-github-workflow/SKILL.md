---
name: gh-git-github-workflow
description: Use git and GitHub CLI (gh) for repos, issues, PRs, comments, releases, gists, Actions, secrets, and API access. Use when working with git, GitHub, pull requests, issues, gh commands, or GitHub workflows.
---

# Git & GitHub CLI Workflow

## Quick Start

**Auth**: `gh auth login` or set `GITHUB_TOKEN` / `GH_TOKEN` for automation.

**Repo context**: Run commands inside a git repo, or use `-R owner/repo` / `GH_REPO=owner/repo`.

## Core Commands by Domain

| Domain | Commands |
|--------|----------|
| **Repos** | `gh repo clone`, `create`, `fork`, `view`, `sync` |
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

1. **Checkout PRs locally**: `gh pr checkout 123` (works for forks too)
2. **Create PR/issue with flags**: `gh pr create --title "..." --body "..."` or `--fill` to use commits
3. **Filter lists**: `gh pr list --state closed --assignee @me`; `gh issue list --label bug`
4. **Status overview**: `gh pr status`, `gh issue status`
5. **Use `--web`** when you need the browser: `gh pr create --web`, `gh issue view 5 -w`

## Output Formatting

- **JSON**: `gh pr list --json number,title,state`
- **jq filter**: `gh pr list --json number,title --jq '.[] | "\(.number): \(.title)"'`
- **Template**: `gh api repos/{owner}/{repo}/issues --template '{{range .}}{{.title}}{{"\n"}}{{end}}'`

## Wiki

gh has no native wiki commands. Use `gh browse --wiki` to open in browser. For editing:

```bash
git clone https://github.com/owner/repo.wiki.git
cd repo.wiki
# Edit .md files, then git add/commit/push
```

GitHub has no dedicated wiki REST API; the wiki is a separate git repo.

## Automation & Aliases

- **Aliases**: `gh alias set prc 'pr create'`; `gh alias set prl 'pr list --assignee @me'`
- **Scripting**: Set `GH_TOKEN`; use `--json` + `jq` for parsing
- **Enterprise**: `gh auth login --hostname <host>`; `export GH_HOST=<host>`

## Additional Commands

- **Auth**: `gh auth status`, `login`, `logout`, `refresh`
- **Config**: `gh config set editor vim`
- **Extensions**: `gh extension list`, `install`, `create`
- **API**: `gh api <endpoint>` for any REST/GraphQL call
- **Labels**: `gh label list`, `create`
- **Org**: `gh org list`, `members`
- **Project**: `gh project list`, `view`
- **Codespace**: `gh codespace list`, `create`, `ssh`
- **SSH/GPG keys**: `gh ssh-key list`, `gh gpg-key list`

## Reference

Full command reference: [reference.md](reference.md)
