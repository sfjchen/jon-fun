# gh CLI Full Command Reference

Source: [cli.github.com/manual](https://cli.github.com/manual)

## Core Commands

### gh repo
`list`, `create`, `clone`, `fork`, `view`, `edit`, `archive`, `unarchive`, `rename`, `sync`, `set-default`, `delete`, `license`, `gitignore`, `deploy-key`, `autolink`

### gh pr
`status`, `list`, `create`, `view`, `checkout`, `checks`, `diff`, `merge`, `review`, `comment`, `edit`, `close`, `reopen`, `ready`, `lock`, `unlock`, `revert`, `update-branch`

### gh issue
`status`, `list`, `create`, `view`, `comment`, `edit`, `close`, `reopen`, `lock`, `unlock`, `pin`, `unpin`, `transfer`, `delete`, `develop`

### gh release
`list`, `create`, `view`, `download`, `upload`, `edit`, `delete`, `delete-asset`, `verify`, `verify-asset`

### gh gist
`create`, `list`, `view`, `edit`, `clone`, `rename`, `delete`

### gh browse
Opens repo in browser. Use `--wiki` for wiki, `--issues`, `--commits`, etc.

### gh auth
`login`, `logout`, `status`, `refresh`, `setup-git`, `token`

### gh api
`gh api <endpoint>` — authenticated REST/GraphQL. Use `{owner}`, `{repo}`, `{branch}` placeholders. Flags: `-X METHOD`, `-f key=value`, `-F key=value` (typed), `--jq`, `--template`, `--paginate`, `--input file`

## GitHub Actions

### gh workflow
`list`, `view`, `run`, `enable`, `disable`

### gh run
`list`, `view`, `watch`, `download`, `rerun`, `delete`

### gh cache
`list`, `delete`

## Secrets & Variables

### gh secret
`list`, `set`, `delete`

### gh variable
`list`, `set`, `delete`

## Search & Discovery

### gh search
`repos`, `issues`, `prs`, `code`, `commits`

## Org & Project

### gh org
`list`, `members`, `teams`

### gh project
`list`, `view`, `create`, `edit`, `delete`, `field-list`, `item-list`, `item-add`, `item-edit`, `item-delete`

## Keys & Config

### gh ssh-key
`list`, `add`, `delete`

### gh gpg-key
`list`, `add`, `delete`

### gh config
`get`, `set`, `list`

## Other

### gh codespace
`list`, `create`, `ssh`, `delete`, `logs`, `ports`, `cp`, `jupyter`

### gh label
`list`, `create`, `edit`, `delete`

### gh ruleset
`list`, `create`, `view`, `update`, `delete`

### gh extension
`list`, `install`, `create`, `upgrade`, `remove`, `browse`

### gh alias
`list`, `set`, `delete`

### gh completion
`-s bash|zsh|fish|powershell`

### gh status
Shows status of relevant PRs/issues

### gh attestation
`verify`, `generate`

### gh copilot
`explain`, `suggest`, `diff`

### gh agent-task
`list`, `create`, `view`, `cancel`

### gh preview
Enable preview features

## Common Examples

```bash
# Repo
gh repo clone owner/repo
gh repo fork --clone
gh repo create my-repo --public --source=.

# PRs
gh pr create --fill
gh pr checkout 123
gh pr list --state merged --author @me
gh pr review 123 --approve -b "LGTM"
gh pr merge 123 --squash

# Issues
gh issue create -t "Bug" -b "Description"
gh issue comment 5 -b "Fixed in #6"
gh issue list --assignee @me --state open

# Releases
gh release create v1.0.0 --notes "Release notes"
gh release download v1.0.0

# Gists
gh gist create file.txt --public
gh gist clone <gist-id>

# Actions
gh workflow run ci.yml
gh run watch
gh run download

# API
gh api repos/{owner}/{repo}/issues --jq '.[].title'
gh api graphql -f query='query { viewer { login } }'
```

## Wiki Note

No native gh wiki commands. Use:
- `gh browse --wiki` to open in browser
- Clone `https://github.com/owner/repo.wiki.git` for local wiki editing (git add/commit/push)
