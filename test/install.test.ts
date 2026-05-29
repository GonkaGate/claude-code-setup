import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { chmod, mkdtemp, mkdir, readFile, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import test from "node:test";
import { parseCliOptions, resolveSettingsTarget } from "../src/cli.js";
import { createBackup } from "../src/install/backup.js";
import { loadSettings } from "../src/install/load-settings.js";
import { ensureLocalSettingsIgnored, stopTrackingLocalSettings } from "../src/install/local-git-ignore.js";
import { mergeSettingsWithGonkaEnv } from "../src/install/merge-env.js";
import { buildModelPromptConfig, buildTrackedLocalSettingsPromptConfig, promptForModel } from "../src/install/prompts.js";
import { validateApiKey } from "../src/install/validate-api-key.js";
import { writeSettings } from "../src/install/write-settings.js";
import { CLAUDE_SETTINGS_SCHEMA_URL, GONKAGATE_BASE_URL } from "../src/constants/gateway.js";
import { DEFAULT_MODEL, DEFAULT_MODEL_KEY, requireSupportedModel } from "../src/constants/models.js";

test("mergeSettingsWithGonkaEnv preserves unrelated settings and updates gateway env", () => {
  const merged = mergeSettingsWithGonkaEnv(
    {
      theme: "light",
      env: {
        KEEP_ME: "yes",
        ANTHROPIC_API_KEY: "old-secret",
        ANTHROPIC_BASE_URL: "https://wrong.example.com"
      }
    },
    "gp-test-key",
    DEFAULT_MODEL
  );

  assert.equal(merged.$schema, CLAUDE_SETTINGS_SCHEMA_URL);
  assert.equal(merged.theme, "light");
  assert.deepEqual(merged.env, {
    KEEP_ME: "yes",
    ANTHROPIC_BASE_URL: GONKAGATE_BASE_URL,
    ANTHROPIC_AUTH_TOKEN: "gp-test-key",
    ANTHROPIC_MODEL: DEFAULT_MODEL.modelId,
    ANTHROPIC_DEFAULT_OPUS_MODEL: DEFAULT_MODEL.modelId,
    ANTHROPIC_DEFAULT_SONNET_MODEL: DEFAULT_MODEL.modelId,
    ANTHROPIC_DEFAULT_HAIKU_MODEL: DEFAULT_MODEL.modelId,
    CLAUDE_CODE_SUBAGENT_MODEL: DEFAULT_MODEL.modelId
  });
});

test("model picker is configured with the default model for enter-to-accept flow", () => {
  const promptConfig = buildModelPromptConfig([DEFAULT_MODEL], DEFAULT_MODEL_KEY);

  assert.equal(promptConfig.default, DEFAULT_MODEL_KEY);
  assert.equal(promptConfig.theme?.indexMode, "number");
});

test("promptForModel returns the default model when the prompt resolves to the default key", async () => {
  const selectedModel = await promptForModel(
    [DEFAULT_MODEL],
    DEFAULT_MODEL_KEY,
    async (config) => config.default
  );

  assert.equal(selectedModel.key, DEFAULT_MODEL_KEY);
  assert.equal(selectedModel.modelId, DEFAULT_MODEL.modelId);
});

test("tracked local settings recovery prompt defaults to stopping tracking", () => {
  const promptConfig = buildTrackedLocalSettingsPromptConfig(".claude/settings.local.json");

  assert.equal(promptConfig.default, "untrack");
  assert.equal(promptConfig.theme?.indexMode, "number");
  assert.match(promptConfig.choices[0]?.description ?? "", /git rm --cached/);
});

test("parseArgs accepts supported --model values and rejects unsupported ones", () => {
  const silentOutput = {
    writeOut: () => {},
    writeErr: () => {}
  };

  assert.equal(parseCliOptions(["--model", DEFAULT_MODEL_KEY], silentOutput).modelKey, DEFAULT_MODEL_KEY);
  assert.equal(parseCliOptions([`--model=${DEFAULT_MODEL_KEY}`], silentOutput).modelKey, DEFAULT_MODEL_KEY);
  assert.throws(() => parseCliOptions(["--model", "not-supported"], silentOutput), /Allowed choices are/);
});

test("supported model registry includes kimi-k2.6", () => {
  const model = requireSupportedModel("kimi-k2.6");

  assert.equal(model.modelId, "moonshotai/Kimi-K2.6");
});

test("supported model registry includes minimax-m2.7", () => {
  const model = requireSupportedModel("minimax-m2.7");

  assert.equal(model.modelId, "minimaxai/minimax-m2.7");
});

test("loadSettings rejects invalid JSON instead of overwriting it", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "gonkagate-invalid-json-"));
  const filePath = path.join(directory, "settings.json");

  await writeFile(filePath, "{not-valid-json", "utf8");

  await assert.rejects(loadSettings(filePath), /Failed to parse JSON/);
});

test("writeSettings writes JSON and createBackup snapshots the previous file", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "gonkagate-write-settings-"));
  const filePath = path.join(directory, "settings.json");

  await writeFile(filePath, JSON.stringify({ env: { BEFORE: "1" } }, null, 2), "utf8");

  const backupPath = await createBackup(filePath);

  await writeSettings(filePath, {
    env: {
      AFTER: "1"
    }
  });

  const backupContents = JSON.parse(await readFile(backupPath, "utf8"));
  const currentContents = JSON.parse(await readFile(filePath, "utf8"));

  assert.deepEqual(backupContents, { env: { BEFORE: "1" } });
  assert.deepEqual(currentContents, { env: { AFTER: "1" } });
});

test("createBackup normalizes backup permissions to owner-only", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "gonkagate-backup-mode-"));
  const filePath = path.join(directory, "settings.json");

  await writeFile(filePath, JSON.stringify({ env: { TOKEN: "secret" } }, null, 2), "utf8");
  await chmod(filePath, 0o644);

  const backupPath = await createBackup(filePath);
  const backupStats = await stat(backupPath);

  assert.equal(backupStats.mode & 0o777, 0o600);
});

test("writeSettings creates owner-only files for secret-bearing settings", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "gonkagate-file-mode-"));
  const filePath = path.join(directory, "settings.json");

  await writeSettings(filePath, {
    env: {
      TOKEN: "secret"
    }
  });

  const fileStats = await stat(filePath);

  assert.equal(fileStats.mode & 0o777, 0o600);
});

test("ensureLocalSettingsIgnored adds the local settings file and backups to git info exclude", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "gonkagate-local-ignore-"));
  const gitDir = path.join(directory, ".git");
  const excludePath = path.join(gitDir, "info", "exclude");
  const targetPath = path.join(directory, ".claude", "settings.local.json");

  initGitRepo(directory);

  await ensureLocalSettingsIgnored(targetPath);

  const excludeContents = await readFile(excludePath, "utf8");

  assert.match(excludeContents, /^\/\.claude\/settings\.local\.json$/m);
  assert.match(excludeContents, /^\/\.claude\/settings\.local\.json\.backup-\*$/m);
});

test("ensureLocalSettingsIgnored rejects a symlinked .claude directory", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "gonkagate-local-symlink-"));
  const gitDir = path.join(directory, ".git");
  const targetPath = path.join(directory, ".claude", "settings.local.json");

  await mkdir(path.join(gitDir, "info"), { recursive: true });
  await writeFile(path.join(gitDir, "HEAD"), "ref: refs/heads/main\n", "utf8");
  await writeFile(path.join(gitDir, "config"), "[core]\n\trepositoryformatversion = 0\n", "utf8");
  await mkdir(path.join(directory, ".github"), { recursive: true });
  await symlink(
    path.join(directory, ".github"),
    path.join(directory, ".claude"),
    process.platform === "win32" ? "junction" : "dir"
  );

  await assert.rejects(
    ensureLocalSettingsIgnored(targetPath),
    /symlinked "\.claude" directory/
  );
});

test("ensureLocalSettingsIgnored rejects a tracked local settings file", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "gonkagate-local-tracked-"));
  const targetPath = await createTrackedLocalSettingsFile(directory);

  await assert.rejects(
    ensureLocalSettingsIgnored(targetPath),
    /already tracked by git/
  );
});

test("stopTrackingLocalSettings removes the local settings file from the git index and adds local excludes", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "gonkagate-local-untrack-"));
  const targetPath = await createTrackedLocalSettingsFile(directory);
  const excludePath = path.join(directory, ".git", "info", "exclude");

  await stopTrackingLocalSettings(targetPath);

  assert.equal(isTrackedInGit(directory, ".claude/settings.local.json"), false);
  assert.deepEqual(JSON.parse(await readFile(targetPath, "utf8")), { env: {} });

  const excludeContents = await readFile(excludePath, "utf8");
  const statusOutput = execFileSync("git", ["-C", directory, "status", "--short"], { encoding: "utf8" });

  assert.match(excludeContents, /^\/\.claude\/settings\.local\.json$/m);
  assert.match(excludeContents, /^\/\.claude\/settings\.local\.json\.backup-\*$/m);
  assert.match(statusOutput, /^D  \.claude\/settings\.local\.json$/m);
  assert.doesNotMatch(statusOutput, /\?\? \.claude\/settings\.local\.json/);
});

test("resolveSettingsTarget can switch a tracked local install to user scope", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "gonkagate-local-switch-user-"));
  const targetPath = await createTrackedLocalSettingsFile(directory);

  const resolvedTarget = await resolveSettingsTarget("local", directory, async (relativeTargetPath) => {
    assert.equal(relativeTargetPath, ".claude/settings.local.json");
    return "user";
  });

  assert.equal(resolvedTarget.scope, "user");
  assert.equal(path.basename(resolvedTarget.path), "settings.json");
  assert.equal(path.basename(path.dirname(resolvedTarget.path)), ".claude");
  assert.equal(isTrackedInGit(directory, ".claude/settings.local.json"), true);
  assert.deepEqual(JSON.parse(await readFile(targetPath, "utf8")), { env: {} });
});

test("resolveSettingsTarget can stop tracking a local settings file and continue locally", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "gonkagate-local-continue-"));
  await createTrackedLocalSettingsFile(directory);

  const resolvedTarget = await resolveSettingsTarget("local", directory, async () => "untrack");
  const statusOutput = execFileSync("git", ["-C", directory, "status", "--short"], { encoding: "utf8" });

  assert.equal(resolvedTarget.scope, "local");
  assert.equal(resolvedTarget.path, path.join(directory, ".claude", "settings.local.json"));
  assert.match(statusOutput, /^D  \.claude\/settings\.local\.json$/m);
});

test("ensureLocalSettingsIgnored rejects a symlinked path component inside the repo", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "gonkagate-local-symlink-component-"));
  const outsideDirectory = path.join(directory, "outside");
  const targetPath = path.join(directory, "linked-workdir", ".claude", "settings.local.json");

  initGitRepo(directory);
  await mkdir(outsideDirectory, { recursive: true });
  await symlink(
    outsideDirectory,
    path.join(directory, "linked-workdir"),
    process.platform === "win32" ? "junction" : "dir"
  );

  await assert.rejects(
    ensureLocalSettingsIgnored(targetPath),
    /symlinked path component/
  );
});

test("validateApiKey requires a gp- prefix", () => {
  assert.equal(validateApiKey(" gp-works "), "gp-works");
  assert.throws(() => validateApiKey("sk-test"), /starts with "gp-"/);
});

function initGitRepo(directory: string): void {
  execFileSync("git", ["init"], { cwd: directory, stdio: "ignore" });
}

function isTrackedInGit(directory: string, relativePath: string): boolean {
  try {
    execFileSync("git", ["-C", directory, "ls-files", "--error-unmatch", "--", relativePath], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

async function createTrackedLocalSettingsFile(directory: string): Promise<string> {
  const targetPath = path.join(directory, ".claude", "settings.local.json");

  initGitRepo(directory);
  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, "{\n  \"env\": {}\n}\n", "utf8");
  execFileSync("git", ["-C", directory, "add", "-f", ".claude/settings.local.json"], { stdio: "ignore" });
  commitAll(directory, "Add tracked local settings");

  return targetPath;
}

function commitAll(directory: string, message: string): void {
  execFileSync("git", ["-C", directory, "commit", "-m", message], {
    stdio: "ignore",
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: "Test User",
      GIT_AUTHOR_EMAIL: "test@example.com",
      GIT_COMMITTER_NAME: "Test User",
      GIT_COMMITTER_EMAIL: "test@example.com"
    }
  });
}
