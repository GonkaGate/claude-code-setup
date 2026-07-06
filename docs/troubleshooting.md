# Troubleshooting

## `/status` still shows Anthropic

If Claude Code still shows direct Anthropic auth or the wrong upstream after install:

1. Run `claude auth logout`
2. Restart `claude`
3. Run `/status` again

The installer writes Claude Code settings, but an existing direct login can still be what you are seeing until you log out once.

## Model unavailable

This installer fetches models from `GET https://api.gonkagate.com/v1/models` with your GonkaGate API key and writes the selected live model id.

If a selected model is unavailable, rerun the installer so it can fetch the current `/v1/models` response for your key. If the model is still returned but fails in Claude Code, the likely cause is a backend deployment or model availability mismatch. This installer does not expose custom base URL or arbitrary model overrides, so the right next step is GonkaGate support or the backend troubleshooting docs in `gonka-proxy`.

## Model removed from GonkaGate later

If a model disappears from GonkaGate's `/v1/models` response:

1. Rerun the installer
2. Choose from the current live list, or pass a current id with `--model <model-id>`

Manual edits to force an old or unsupported model id are outside the supported setup flow.

## Want to switch models

Rerun the installer and choose a different live model when prompted.

You can also skip the interactive model prompt with:

```bash
npx @gonkagate/claude-code --model <model-id>
```

The setup-style alias accepts the same options:

```bash
npx @gonkagate/claude-code-setup --model <model-id>
```

Only model ids returned by `/v1/models` for your key are accepted.

## Corrupted settings file

If the target settings file contains invalid JSON, the installer stops without overwriting it.

Restore from the timestamped backup next to the settings file, or fix the JSON manually, then rerun the installer.

## Want repo-only setup

Rerun the installer and choose `local` scope. That writes `.claude/settings.local.json` in the current repository instead of editing your global `~/.claude/settings.json`.

## `.claude/settings.local.json` is already tracked by git

For `local` scope, the installer now detects when `.claude/settings.local.json` is already a tracked file in the repository and offers a recovery choice.

The recommended option is to stop tracking that file and continue. The installer will:

- run `git rm --cached` for `.claude/settings.local.json`
- keep the file in your working tree
- add local exclude entries so the file stays uncommitted going forward

If that repository intentionally versions `.claude/settings.local.json`, choose `user` scope instead.

You can still do the stop-tracking step manually if you prefer:

```bash
git rm --cached -- .claude/settings.local.json
```

## Local install refused because the target path uses a symlink

For `local` scope, the installer now rejects a symlinked path component anywhere on the way to `.claude/settings.local.json`, including a symlinked `.claude` directory or a symlinked `.claude/settings.local.json`.

That safety check prevents a repository from redirecting your API key into some other location that git might track.

Replace the symlink with a real `.claude` directory, then rerun the installer.

## Manual settings edits

Manual edits to the Claude Code settings file are possible, but they are outside the supported public install flow for this repo.

If you want to get back to a supported state, rerun the installer instead of hand-editing model ids or gateway values.

## Want to undo the install

You have two safe options:

1. Restore the backup created by the installer.
2. Remove the GonkaGate-managed keys from the target settings file:
   - `ANTHROPIC_BASE_URL`
   - `ANTHROPIC_AUTH_TOKEN`
   - `ANTHROPIC_MODEL`
   - `ANTHROPIC_DEFAULT_OPUS_MODEL`
   - `ANTHROPIC_DEFAULT_SONNET_MODEL`
   - `ANTHROPIC_DEFAULT_HAIKU_MODEL`
   - `CLAUDE_CODE_SUBAGENT_MODEL`

If you previously removed `ANTHROPIC_API_KEY`, add back whatever auth method you actually want before relaunching Claude Code.
