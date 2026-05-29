# How It Works

`gonkagate-claude-code` is a small Node-based installer for local `Claude Code`.

The primary package remains `@gonkagate/claude-code`. The setup-style alias package `@gonkagate/claude-code-setup` runs the same installer for consistency with the other GonkaGate agent setup packages.

## Fixed product contract

These values are intentionally fixed by the installer:

- Base URL: `https://api.gonkagate.com`
- Auth variable: `ANTHROPIC_AUTH_TOKEN`
- Model selection comes only from a curated in-repo allowlist

Today the curated public Claude Code model registry contains:

- `qwen3-235b` -> `qwen/qwen3-235b-a22b-instruct-2507-fp8`
- `kimi-k2.6` -> `moonshotai/Kimi-K2.6` (default)
- `minimax-m2.7` -> `minimaxai/minimax-m2.7`

Users provide only:

- a GonkaGate API key starting with `gp-`
- a supported model choice from the curated list, or `--model <model-key>`
- an install scope: `user` or `local`

## Target files

The installer writes one Claude Code settings file:

- user scope -> `~/.claude/settings.json`
- local scope -> `.claude/settings.local.json`

It does not touch any shell profile or other configuration file.

For `local` scope inside a git repository, it also adds `.claude/settings.local.json` and `.claude/settings.local.json.backup-*` to `.git/info/exclude` before writing the file.

For safety, local scope checks whether `.claude/settings.local.json` is already tracked by git. If it is, the installer offers to stop tracking that file and continue local setup, or switch to `user` scope instead. It also refuses any existing symlinked path component on the way to the target. That includes a symlinked `.claude` directory and a symlinked local settings file.

## Write behavior

When the target file already exists, the installer:

1. Parses the existing JSON
2. Refuses to continue if the JSON is invalid
3. Creates a timestamped backup with owner-only permissions
4. Preserves unrelated settings
5. Updates only the relevant `env` keys, including all Claude model env vars with the selected curated model id
6. Adds Claude Code's JSON schema if `$schema` is missing
7. Writes the final settings file with owner-only permissions

If `ANTHROPIC_API_KEY` is present, it is removed so bearer-token auth through `ANTHROPIC_AUTH_TOKEN` becomes the default path.
