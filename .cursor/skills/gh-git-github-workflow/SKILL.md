---
name: gh-git-github-workflow
description: Use git and GitHub CLI (gh) for repos, issues, PRs, comments, releases, gists, Actions, secrets, wiki, and API access. Use when working with git, GitHub, pull requests, issues, gh commands, or GitHub workflows.
---
# Git & GitHub CLI Workflow

## Quick Start

**Auth**: `gh auth login` or set `GITHUB_TOKEN` / `GH_TOKEN` for automation.

**Repo context**: Run commands inside a git repo, or use `-R owner/repo` / `GH_REPO=owner/repo`.

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

gh has no native wiki commands. Wiki is a separate git repo; edit via clone → edit .md → push.

**Enable wiki** (if not enabled): `gh repo edit owner/repo --enable-wiki`

**Find wiki URL** from current repo: `gh repo view --json nameWithOwner -q ".nameWithOwner"` → `owner/repo` → wiki URL is `https://github.com/owner/repo.wiki.git`

**Clone wiki** (from inside repo):
```bash
git clone "https://github.com/$(gh repo view --json nameWithOwner -q ".nameWithOwner").wiki.git"
cd repo.wiki
```

**Edit**: Edit `.md` files (e.g. `Home.md`), then `git add`, `git commit`, `git push`.

**Note**: The wiki repo is created only after the first page is added via the web UI. If clone fails with "Repository not found", enable wiki and create the first page at `gh browse --wiki`.

## Automation & Aliases

- **Aliases**: `gh alias set prc 'pr create'`; `gh alias set prl 'pr list --assignee @me'`
- **Scripting**: Set `GH_TOKEN`; use `--json` + `jq` for parsing
- **Enterprise**: `gh auth login --hostname <host>`; `export GH_HOST=<host>`

## Full Command Reference

**repo**: list, create, clone, fork, view, edit, archive, unarchive, rename, sync, set-default, delete, license, gitignore, deploy-key, autolink

**pr**: status, list, create, view, checkout, checks, diff, merge, review, comment, edit, close, reopen, ready, lock, unlock, revert, update-branch

**issue**: status, list, create, view, comment, edit, close, reopen, lock, unlock, pin, unpin, transfer, delete, develop

**release**: list, create, view, download, upload, edit, delete, delete-asset, verify, verify-asset

**gist**: create, list, view, edit, clone, rename, delete

**browse**: Use `--wiki`, `--issues`, `--commits` for specific views

**auth**: login, logout, status, refresh, setup-git, token

**api**: `gh api <endpoint>` — REST/GraphQL. Placeholders: `{owner}`, `{repo}`, `{branch}`. Flags: `-X`, `-f`, `-F`, `--jq`, `--template`, `--paginate`

**workflow**: list, view, run, enable, disable | **run**: list, view, watch, download, rerun, delete | **cache**: list, delete

**secret/variable**: list, set, delete

**search**: repos, issues, prs, code, commits

**org**: list, members, teams | **project**: list, view, create, edit, delete, field-list, item-list, item-add, item-edit, item-delete

**ssh-key/gpg-key**: list, add, delete | **config**: get, set, list

**codespace**: list, create, ssh, delete, logs, ports, cp, jupyter | **label**: list, create, edit, delete

**ruleset**: list, create, view, update, delete | **extension**: list, install, create, upgrade, remove, browse

**alias**: list, set, delete | **completion**: `-s bash|zsh|fish|powershell`

**status**: PRs/issues relevant to you | **attestation**: verify, generate | **copilot**: explain, suggest, diff | **agent-task**: list, create, view, cancel | **preview**: Enable preview features

## Common Examples

```bash
gh repo clone owner/repo
gh repo fork --clone
gh repo create my-repo --public --source=.
gh pr create --fill
gh pr checkout 123
gh pr list --state merged --author @me
gh pr review 123 --approve -b "LGTM"
gh pr merge 123 --squash
gh issue create -t "Bug" -b "Description"
gh issue comment 5 -b "Fixed in #6"
gh release create v1.0.0 --notes "Release notes"
gh release download v1.0.0
gh gist create file.txt --public
gh workflow run ci.yml
gh run watch
gh api repos/{owner}/{repo}/issues --jq '.[].title'
```
