# @gonkagate/claude-code

Set up Claude Code to use GonkaGate in one `npx` command.

```bash
npx @gonkagate/claude-code
```

![Package](https://img.shields.io/badge/package-%40gonkagate%2Fclaude--code-6E63FF?style=flat-square)
![Node](https://img.shields.io/badge/node-%3E%3D18-4DA2FF?style=flat-square)
![License](https://img.shields.io/badge/license-Apache--2.0-2A2A2A?style=flat-square)

[![Website](https://img.shields.io/badge/Website-gonkagate.com-111827?style=flat-square)](https://gonkagate.com/en)
[![Docs](https://img.shields.io/badge/Docs-API%20Guides-2563EB?style=flat-square)](https://gonkagate.com/en/docs)
[![API%20Key](https://img.shields.io/badge/API%20Key-Dashboard-F97316?style=flat-square)](https://gonkagate.com/en/register)
[![Telegram](https://img.shields.io/badge/Telegram-%40gonkagate-229ED9?style=flat-square&logo=telegram&logoColor=white)](https://t.me/gonkagate)
[![X](https://img.shields.io/badge/X-%40gonkagate-000000?style=flat-square&logo=x&logoColor=white)](https://x.com/gonkagate)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-GonkaGate-0A66C2?style=flat-square&logo=linkedin&logoColor=white)](https://www.linkedin.com/company/gonkagate)

## See It In Action

From API key to a working Claude Code setup in one short walkthrough:

[![See the installer in action](https://raw.githubusercontent.com/GonkaGate/gonkagate-claude-code/main/.github/assets/gonkagate-claude-code-demo.gif)](https://raw.githubusercontent.com/GonkaGate/gonkagate-claude-code/main/.github/assets/gonkagate-claude-code-demo.mp4)

Need an API key first? [Create one on GonkaGate](https://gonkagate.com/en).

## Overview

`@gonkagate/claude-code` is for developers who already have local `Claude Code`
and want to use it with GonkaGate without editing shell profiles, exporting
long env var blocks, or writing `.env` files by hand.

Under the hood it configures Claude Code to use GonkaGate's Anthropic-
compatible endpoint at `https://api.gonkagate.com`.

It does not install `Claude Code` itself. It configures an existing local
Claude Code install.

For setup-style naming consistency, the alias
`npx @gonkagate/claude-code-setup` runs the same installer.

You will be asked for:

- your GonkaGate API key (`gp-...`) in a hidden interactive prompt
- a model from the supported GonkaGate list
- setup scope: `user` or `local`

If you choose `local` scope and `.claude/settings.local.json` is already tracked by git, the installer offers to stop tracking that file and continue, or switch to `user` scope instead.

You need:

- local `Claude Code`
- Node.js 18+
- a GonkaGate API key

## Supported Models

Current public Claude Code models in the curated registry:

- `qwen3-235b` -> `qwen/qwen3-235b-a22b-instruct-2507-fp8`
- `kimi-k2.6` -> `moonshotai/Kimi-K2.6` (default)
- `minimax-m2.7` -> `minimaxai/minimax-m2.7`

## What It Does

The tool writes Claude Code settings so you can keep running `claude` normally afterward.

By default it writes to:

- `~/.claude/settings.json`

If you choose local scope, it writes to:

- `.claude/settings.local.json`

It also:

- preserves unrelated Claude Code settings
- creates a backup before overwriting an existing settings file
- writes settings files with owner-only permissions
- writes backup files with owner-only permissions
- adds `.claude/settings.local.json` and local backup files to `.git/info/exclude` for local setup inside a git repo
- offers to stop tracking `.claude/settings.local.json` before local setup writes secrets into a file that was already tracked by git
- refuses local setup if the target path traverses a symlinked path component, or if `.claude` / the local settings file is a symlink

## Fixed GonkaGate Setup

These parts are intentionally fixed:

- Base URL: `https://api.gonkagate.com`
- Auth variable: `ANTHROPIC_AUTH_TOKEN`
- Model choice: only from the curated supported list

This tool does not ask for a custom base URL and does not accept arbitrary custom model IDs.

The selected model is written into all Claude Code model env vars used by this setup flow.

## Verify

After setup:

1. If Claude Code was previously logged directly into Anthropic, run `claude auth logout`
2. Start Claude Code normally with `claude`
3. Run `/status`
4. Confirm the active gateway is `https://api.gonkagate.com`

## What This Tool Does Not Do

- It does not configure `claude.ai`
- It does not install `Claude Code` itself
- It does not edit `.zshrc`, `.bashrc`, PowerShell profiles, or other shell startup files
- It does not write `.env` files
- It does not support arbitrary custom model IDs
- It does not support custom base URL overrides

## Need Help?

- Troubleshooting: [docs/troubleshooting.md](https://github.com/GonkaGate/gonkagate-claude-code/blob/main/docs/troubleshooting.md)
- Security notes: [docs/security.md](https://github.com/GonkaGate/gonkagate-claude-code/blob/main/docs/security.md)
- Internal behavior: [docs/how-it-works.md](https://github.com/GonkaGate/gonkagate-claude-code/blob/main/docs/how-it-works.md)

## Development

```bash
npm install
npm run dev
```

Useful commands:

- `npm run build`
- `npm test`
- `npm run ci`
