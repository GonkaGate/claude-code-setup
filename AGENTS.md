# AGENTS.md

## What This Repository Is

`gonkagate-claude-code` is the public open-source onboarding repository for GonkaGate API users who want to run local `Claude Code` through the GonkaGate Anthropic-compatible gateway without manually pasting long blocks of `export` variables.

The core idea of this repo is:

- provide one short public entrypoint
- reduce onboarding to a single command
- avoid asking users to edit shell profile files
- avoid making users understand Anthropic gateway wiring by hand

Recommended public flow:

```bash
npx @gonkagate/claude-code
```

Setup-style alias for consistency with other GonkaGate agent installers:

```bash
npx @gonkagate/claude-code-setup
```

The happy-path installer interactively prompts only for:

- a `gp-...` API key
- a model picker from the curated allowlist
- install scope: `user` or `local`

If the user chooses `local` scope and `.claude/settings.local.json` is already tracked by git, the installer shows a short recovery prompt so the user can either:

- stop tracking `.claude/settings.local.json` and continue local setup
- switch to `user` scope instead

Everything else is fixed by product design.

If the installer UX changes, this block in `AGENTS.md` must be updated immediately so it remains an accurate description of the current public flow.

If the library surface used for prompts, CLI parsing, or settings writing changes, this document must also be updated so it stays truthful about the real implementation.

## Fixed Product Invariants

These decisions are part of the repo contract. Changing them is not a small refactor; it is a product change.

- `ANTHROPIC_BASE_URL` is always `https://api.gonkagate.com`
- users do not choose the base URL and cannot override it
- the default auth path is `ANTHROPIC_AUTH_TOKEN`
- model choice comes only from a code-owned curated registry
- the primary UX is `npx @gonkagate/claude-code`
- the setup-style alias is `npx @gonkagate/claude-code-setup`
- API key entry must remain interactive and hidden
- the installer writes Claude Code settings, not shell env and not shell rc files
- default scope is `user`
- advanced scope is `local`
- unrelated settings must survive
- the installer must create a backup before overwriting an existing settings file
- if the target settings file contains `ANTHROPIC_API_KEY`, it should be removed in favor of bearer-mode default auth
- local scope must protect `.claude/settings.local.json` from git before secrets are written
- settings files must be written with owner-only permissions

Current curated public Claude Code model registry:

- `qwen3-235b` -> `qwen/qwen3-235b-a22b-instruct-2507-fp8`
- `kimi-k2.6` -> `moonshotai/Kimi-K2.6` (default)
- `minimax-m2.7` -> `minimaxai/minimax-m2.7`

## What the Repo Does and Does Not Do

This repo does:

- onboarding for local `Claude Code` CLI
- persistent config writing into Claude Code settings
- user-scoped install
- local/project-scoped install
- backup, merge, and validation logic
- troubleshooting and security docs

This repo does not do:

- `claude.ai` setup
- OAuth or browser auth flows
- backend changes
- shell profile mutation
- custom base URL setup
- arbitrary custom model setup

## Repository Structure

```text
.
├── AGENTS.md
├── README.md
├── CHANGELOG.md
├── LICENSE
├── package.json
├── package-lock.json
├── tsconfig.json
├── bin/
│   └── gonkagate-claude-code.js
├── src/
│   ├── cli.ts
│   ├── constants/
│   │   ├── gateway.ts
│   │   └── models.ts
│   ├── install/
│   │   ├── backup.ts
│   │   ├── load-settings.ts
│   │   ├── local-git-ignore.ts
│   │   ├── merge-env.ts
│   │   ├── object-utils.ts
│   │   ├── prompts.ts
│   │   ├── settings-paths.ts
│   │   ├── validate-api-key.ts
│   │   └── write-settings.ts
│   └── types/
│       └── settings.ts
├── docs/
│   ├── how-it-works.md
│   ├── security.md
│   └── troubleshooting.md
├── scripts/
│   ├── install.ps1
│   ├── install.sh
│   └── publish-alias-package.mjs
└── test/
    └── install.test.ts
```

## How the Code Is Organized

### `src/cli.ts`

This is the main installer entrypoint.

CLI parsing and help output are now implemented with `commander` rather than hand-rolled argv parsing.

It is responsible for:

- parsing CLI args through `commander`
- rendering help and version output
- running the hidden API key prompt
- selecting the model
- selecting the scope
- determining the target settings file
- running local git-ignore protection for `local` scope
- recovering tracked local settings files by offering stop-tracking or `user`-scope fallback
- loading the current settings JSON
- merging GonkaGate env into the existing config
- creating a backup before write
- writing the final file and showing next steps

### `src/constants/`

This is where the fixed product values live:

- `gateway.ts` stores the public base URL and Claude Code JSON schema URL
- `models.ts` stores the curated supported model registry and default entry

This is one of the most sensitive parts of the repo. Do not add extra configurability here without an explicit product decision.

### `src/install/prompts.ts`

This file contains the interactive prompts built on top of `@inquirer/prompts`:

- hidden prompt for API key
- model picker from the curated registry
- scope picker
- tracked-local-settings recovery picker when `.claude/settings.local.json` is already tracked by git

The key rule here is: do not log secrets and do not turn the main UX into CLI args for secrets. Do not move back to raw keypress handling if the library-backed prompt still covers the use case.

### `src/install/settings-paths.ts`

Defines the Claude Code settings file path:

- `user` -> `~/.claude/settings.json`
- `local` -> `.claude/settings.local.json`

### `src/install/load-settings.ts`

Safely reads the target file.

Rules:

- if the file does not exist, start from an empty object
- if the JSON is broken, the installer must stop
- the installer must not silently overwrite a corrupted file

### `src/install/merge-env.ts`

This is the core business-logic merge layer.

It must:

- preserve unrelated top-level keys
- preserve unrelated `env` keys
- write all GonkaGate-managed env keys
- apply the selected curated model to all Claude model env vars
- remove `ANTHROPIC_API_KEY`
- add `$schema` if it is missing

### `src/install/backup.ts`

Creates a timestamped backup next to the existing settings file before the new content is written.

### `src/install/write-settings.ts`

Writes JSON to disk through `write-file-atomic`.

Expected behavior:

- create directories when needed
- write valid JSON
- enforce owner-only permissions
- avoid touching anything outside the target settings file

### `src/install/local-git-ignore.ts`

This is specific to `local` scope.

Its job is to:

- find the git repository
- detect when `.claude/settings.local.json` is already tracked by git
- after user consent, stop tracking `.claude/settings.local.json` before writing secrets
- add `.claude/settings.local.json` to `.git/info/exclude` when appropriate
- refuse symlinked path components that could redirect the local settings write outside the intended repo-local path

This helps enforce the invariant that the local secret-bearing settings file should not get committed accidentally.

### `docs/`

Public user-facing documentation:

- `how-it-works.md` explains the installer contract
- `security.md` explains secret handling
- `troubleshooting.md` covers common problems

### `scripts/`

Fallback entrypoints:

- `install.sh`
- `install.ps1`

Alias publishing:

- `publish-alias-package.mjs` builds the `@gonkagate/claude-code-setup` alias package from the current root build output
- if that alias package is not visible on npm yet, the script skips alias publishing so the primary `@gonkagate/claude-code` release can complete; bootstrap the alias package with `--allow-create-package` or `ALLOW_ALIAS_PACKAGE_CREATE=1`, then configure Trusted Publishing before requiring alias publish success
- alias package publishing uses provenance only in GitHub Actions OIDC; local bootstrap publishes without provenance because npm cannot generate it outside a supported CI provider

They must not replace `npx` as the primary public UX.

### `test/install.test.ts`

Baseline tests cover:

- merge behavior
- model selection behavior
- invalid JSON handling
- backup/write flow
- API key validation

## Installer Happy Path

1. The user runs `npx @gonkagate/claude-code` or the setup-style alias `npx @gonkagate/claude-code-setup`
2. The installer securely prompts for a `gp-...` API key
3. The installer shows the curated model picker
4. The installer asks for scope: `user` or `local`
5. The target settings file is resolved
6. For `local` scope, the target path is validated to stay repo-local, the installer adds an ignore entry to `.git/info/exclude` when local write proceeds, and if `.claude/settings.local.json` is already tracked by git it offers to stop tracking that file or switch to `user` scope
7. If the settings file already exists, it is read and validated
8. A backup is created
9. GonkaGate env values, including the selected model, are merged into settings
10. JSON is written back to disk
11. The installer prints next steps: `claude auth logout`, `claude`, `/status`

## What Must Not Be Broken

- Do not add a base URL prompt
- Do not add free-form custom model input
- Do not make `--api-key` a recommended or supported path
- Do not modify shell rc files
- Do not write `.env`
- Do not destroy unrelated Claude Code settings
- Do not silently overwrite invalid JSON
- Do not print API keys to stdout
- Do not turn the public README into backend-heavy documentation
- Do not replace `@inquirer/prompts`, `commander`, or `write-file-atomic` with hand-rolled code again unless there is a strong reason

## Development Commands

Install dependencies:

```bash
npm install
```

Run in dev mode:

```bash
npm run dev
```

Build:

```bash
npm run build
```

Tests:

```bash
npm test
```

Check the publishable package:

```bash
npm pack --dry-run
```

## How to Make Changes Safely

- First decide whether the change is a product contract change or only a technical improvement
- Treat changes in `src/constants/` and `src/install/merge-env.ts` as high-sensitivity
- Keep installer UX changes in sync with `README.md` and `docs/`
- Update `CHANGELOG.md` when public behavior changes
- For local scope, do not weaken the protection against accidentally committing the local settings file
- If you add new merge or write behavior, add a test in `test/install.test.ts`

## Release Automation

This repository uses `release-please` on pushes to `main`.

- Releasable changes must use a conventional commit style title such as `fix: ...` or `feat: ...`
- In this repository, the merged PR title is especially important because GitHub merge commits on `main` use that title
- A PR title like `Add X` or `Update Y` can merge successfully but still fail to produce a release PR
- If the goal is to ship a user-facing fix, make the PR title releasable before merge rather than trying to repair the release afterward
- When a releasable change has already landed without a conventional title, follow up with a small releasable PR so `release-please` can cut the next release

## Areas That Require Extra Caution

Pause and double-check if your change touches:

- secret handling
- Claude Code settings format
- backup and restore behavior
- git ignore behavior for local scope
- default auth path
- the curated model registry
- the public install command

## Repo Philosophy

This repository should stay onboarding-first.

It is not a general-purpose Anthropic gateway configurator and not a playground for dozens of options. Its value is that users get one obvious, short, and safe path: enter a `gp-...` key, choose a model, choose a scope, and then keep running `claude` normally.
