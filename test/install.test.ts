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
import { fetchGonkaGateModels, getDefaultModel, parseGonkaGateModelsResponse, requireModelById } from "../src/install/models.js";
import { buildModelPromptConfig, buildTrackedLocalSettingsPromptConfig, promptForModel } from "../src/install/prompts.js";
import { validateApiKey } from "../src/install/validate-api-key.js";
import { writeSettings } from "../src/install/write-settings.js";
import { CLAUDE_SETTINGS_SCHEMA_URL, GONKAGATE_BASE_URL } from "../src/constants/gateway.js";

const LIVE_MODELS = parseGonkaGateModelsResponse({
  data: [
    { id: "provider/live-alpha", name: "Live Alpha" },
    { id: "provider/live-beta", name: "Live Beta" }
  ]
});
const LIVE_DEFAULT_MODEL = getDefaultModel(LIVE_MODELS);

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
    LIVE_DEFAULT_MODEL
  );

  assert.equal(merged.$schema, CLAUDE_SETTINGS_SCHEMA_URL);
  assert.equal(merged.theme, "light");
  assert.deepEqual(merged.env, {
    KEEP_ME: "yes",
    ANTHROPIC_BASE_URL: GONKAGATE_BASE_URL,
    ANTHROPIC_AUTH_TOKEN: "gp-test-key",
    ANTHROPIC_MODEL: LIVE_DEFAULT_MODEL.id,
    ANTHROPIC_DEFAULT_OPUS_MODEL: LIVE_DEFAULT_MODEL.id,
    ANTHROPIC_DEFAULT_SONNET_MODEL: LIVE_DEFAULT_MODEL.id,
    ANTHROPIC_DEFAULT_HAIKU_MODEL: LIVE_DEFAULT_MODEL.id,
    CLAUDE_CODE_SUBAGENT_MODEL: LIVE_DEFAULT_MODEL.id
  });
});

test("model picker is configured from every fetched live model", () => {
  const promptConfig = buildModelPromptConfig(LIVE_MODELS, LIVE_DEFAULT_MODEL.id);

  assert.equal(promptConfig.default, "provider/live-alpha");
  assert.deepEqual(promptConfig.choices.map((choice) => choice.value), ["provider/live-alpha", "provider/live-beta"]);
  assert.equal(promptConfig.theme?.indexMode, "number");
});

test("arbitrary fetched model id is selectable and written", async () => {
  const selectedModel = await promptForModel(
    LIVE_MODELS,
    LIVE_DEFAULT_MODEL.id,
    async () => "provider/live-beta"
  );
  const merged = mergeSettingsWithGonkaEnv({}, "gp-test-key", selectedModel);

  assert.equal(selectedModel.id, "provider/live-beta");
  assert.equal(merged.env?.ANTHROPIC_MODEL, "provider/live-beta");
});

test("tracked local settings recovery prompt defaults to stopping tracking", () => {
  const promptConfig = buildTrackedLocalSettingsPromptConfig(".claude/settings.local.json");

  assert.equal(promptConfig.default, "untrack");
  assert.equal(promptConfig.theme?.indexMode, "number");
  assert.match(promptConfig.choices[0]?.description ?? "", /git rm --cached/);
});

test("parseArgs accepts arbitrary --model ids and still rejects --api-key", () => {
  const silentOutput = {
    writeOut: () => {},
    writeErr: () => {}
  };

  assert.equal(parseCliOptions(["--model", "provider/live-gamma"], silentOutput).modelId, "provider/live-gamma");
  assert.equal(parseCliOptions(["--model=provider/live-delta"], silentOutput).modelId, "provider/live-delta");
  assert.throws(() => parseCliOptions(["--api-key", "gp-test-key"], silentOutput), /intentionally unsupported/);
});

test("fetchGonkaGateModels calls /v1/models with bearer auth", async () => {
  const models = await fetchGonkaGateModels("gp-test-key", async (input, init) => {
    assert.equal(input, "https://api.gonkagate.com/v1/models");
    assert.deepEqual(init.headers, {
      Accept: "application/json",
      Authorization: "Bearer gp-test-key"
    });

    return {
      ok: true,
      status: 200,
      json: async () => ({
        data: [
          { id: "provider/live-epsilon", name: "Live Epsilon" }
        ]
      })
    };
  });

  assert.equal(models[0]?.id, "provider/live-epsilon");
});

test("live model response is deduped and can mark a dynamic default", () => {
  const models = parseGonkaGateModelsResponse({
    default_model: "provider/live-beta",
    data: [
      { id: "provider/live-alpha", name: "Live Alpha" },
      { id: "provider/live-beta", name: "Live Beta" },
      { id: "provider/live-alpha", name: "Duplicate Alpha" }
    ]
  });

  assert.deepEqual(models.map((model) => model.id), ["provider/live-alpha", "provider/live-beta"]);
  assert.equal(getDefaultModel(models).id, "provider/live-beta");
});

test("live model validation rejects missing and invalid responses", () => {
  assert.equal(requireModelById(LIVE_MODELS, "provider/live-alpha").id, "provider/live-alpha");
  assert.throws(() => requireModelById(LIVE_MODELS, "provider/missing"), /Unsupported model id/);
  assert.throws(() => parseGonkaGateModelsResponse({ data: [] }), /did not include any model ids/);
  assert.throws(() => parseGonkaGateModelsResponse({ data: [{ id: "" }] }), /non-empty string id/);
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
