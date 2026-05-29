# Changelog

## Unreleased

- Added curated model support for `minimax-m2.7` -> `minimaxai/minimax-m2.7` in the installer model picker and docs.
- Added curated model support for `kimi-k2.6` -> `moonshotai/Kimi-K2.6` in the installer model picker and docs.
- Made local alias package bootstrap publish without npm provenance because provenance requires a supported CI/OIDC provider.
- Made alias package publishing skip cleanly until `@gonkagate/claude-code-setup` is bootstrapped on npm, with an explicit override for the first package publish.
- Added `@gonkagate/claude-code-setup` as a setup-style alias for the existing Claude Code installer.
- Improved npm package metadata and README copy for better package-page clarity, discovery, and onboarding.
- Added a curated model registry and model picker to the public installer flow.
- Added `--model <model-key>` and `--model=<model-key>` support for curated non-secret model selection.
- Kept the public Claude Code contract tight by limiting model selection to the curated GonkaGate registry only.
- Updated docs and tests for model selection while preserving local git ignore protection and owner-only settings file permissions.
- Hardened local scope against symlinked `.claude` paths that could redirect secret writes outside the ignored settings path.
- Extended local git protection to ignore timestamped backup files for `.claude/settings.local.json`.
- Normalized backup permissions to owner-only mode so secret-bearing backups are not left world-readable.
- Hardened local scope so `.claude/settings.local.json` cannot keep tracking secrets in git before local setup proceeds.
- Replaced the tracked-local-settings hard stop with a recovery flow that can stop tracking the file or switch to user scope without rerunning setup.
- Hardened local scope against symlinked path components anywhere between the repo root and the target settings file.
- Pinned GitHub Actions workflows to immutable commit SHAs for release pipeline hardening.
- Restored automated npm publish dispatch after Release Please creates a new release tag.
- Made publish reruns skip versions that are already present on npm instead of failing with a duplicate-version error.

## [0.4.0](https://github.com/GonkaGate/claude-code-setup/compare/v0.3.0...v0.4.0) (2026-05-29)


### Features

* add minimax-m2.7 to model registry ([0c8f857](https://github.com/GonkaGate/claude-code-setup/commit/0c8f8571d5153c46c2ca1f8a7adc9933f53d1ae4))
* add minimax-m2.7 to model registry ([887de0a](https://github.com/GonkaGate/claude-code-setup/commit/887de0aed2cb9e59c7da0e60094f80dc0fdd016d))

## [0.3.0](https://github.com/GonkaGate/claude-code-setup/compare/v0.2.1...v0.3.0) (2026-04-29)


### Features

* add kimi-k2.6 to curated model registry ([f19cfc7](https://github.com/GonkaGate/claude-code-setup/commit/f19cfc78cc5246699e065b045a7ec40309694e02))


### Bug Fixes

* make kimi-k2.6 the default curated model ([9a444e0](https://github.com/GonkaGate/claude-code-setup/commit/9a444e035c8f5be5ab5bc13770b58457f316276a))

## [0.2.1](https://github.com/GonkaGate/gonkagate-claude-code/compare/v0.2.0...v0.2.1) (2026-04-13)


### Bug Fixes

* allow alias publish bootstrap override ([423e3b3](https://github.com/GonkaGate/gonkagate-claude-code/commit/423e3b32e9d604586624296848db3ea1923a7110))
* omit provenance for local alias bootstrap ([9529587](https://github.com/GonkaGate/gonkagate-claude-code/commit/95295871b2b37f2742fbe76af3193c1ee8cd2e2f))
* skip alias publish before npm bootstrap ([f4c4c2a](https://github.com/GonkaGate/gonkagate-claude-code/commit/f4c4c2aaad7cf1c0584d5bcd88751e63e2ffb8da))

## [0.2.0](https://github.com/GonkaGate/gonkagate-claude-code/compare/v0.1.3...v0.2.0) (2026-04-13)


### Features

* add Claude Code setup alias ([3d411f5](https://github.com/GonkaGate/gonkagate-claude-code/commit/3d411f5c0cbafd84d10cf8339e9d392bd8043a26))
* add Claude Code setup alias ([caa0711](https://github.com/GonkaGate/gonkagate-claude-code/commit/caa07114025b305a36d9a3e92deb8e565d185b15))

## [0.1.3](https://github.com/GonkaGate/gonkagate-claude-code/compare/v0.1.2...v0.1.3) (2026-03-31)


### Bug Fixes

* document release-please title requirements ([5fce744](https://github.com/GonkaGate/gonkagate-claude-code/commit/5fce7441dfd0c79d6f6ab43b4fa20737df879516))
* document release-please title requirements ([145f9f7](https://github.com/GonkaGate/gonkagate-claude-code/commit/145f9f72da19cf31f8f73e8250047988ee1eb9bf))

## [0.1.2](https://github.com/GonkaGate/gonkagate-claude-code/compare/v0.1.1...v0.1.2) (2026-03-31)


### Bug Fixes

* restore automated npm publishes ([42bde87](https://github.com/GonkaGate/gonkagate-claude-code/commit/42bde8795e264c8950017aa5acff0475b4fb0c8e))
* restore automated npm publishes ([52fcd8e](https://github.com/GonkaGate/gonkagate-claude-code/commit/52fcd8e428ccae967871aba800344dd786a048ce))

## [0.1.1](https://github.com/GonkaGate/gonkagate-claude-code/compare/v0.1.0...v0.1.1) (2026-03-31)


### Bug Fixes

* stop duplicate npm publishes ([1ac876a](https://github.com/GonkaGate/gonkagate-claude-code/commit/1ac876a4fb1c99bd1a1cc892e38ee2c7df3be799))
* stop duplicate npm publishes ([58d022f](https://github.com/GonkaGate/gonkagate-claude-code/commit/58d022ff2486fa6156badc791cb236f580b68a9c))

## 0.1.0

- Initial public onboarding repo for connecting local Claude Code to GonkaGate.
- Added interactive Node CLI installer with hidden API key prompt.
- Added user and local Claude Code settings install scopes.
- Added JSON merge, backup, and validation behavior for Claude Code settings.
- Added public README plus troubleshooting, security, and how-it-works docs.
