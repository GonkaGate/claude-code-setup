import process from "node:process";
import { basename } from "node:path";
import { pathToFileURL } from "node:url";
import { Command, CommanderError, Option } from "commander";
import { createBackup } from "./install/backup.js";
import { loadSettings } from "./install/load-settings.js";
import { ensureLocalSettingsIgnored, stopTrackingLocalSettings, TrackedLocalSettingsError } from "./install/local-git-ignore.js";
import { mergeSettingsWithGonkaEnv } from "./install/merge-env.js";
import { fetchGonkaGateModels, getDefaultModel, requireModelById } from "./install/models.js";
import { promptForApiKey, promptForModel, promptForScope, promptForTrackedLocalSettingsAction } from "./install/prompts.js";
import { getSettingsTarget } from "./install/settings-paths.js";
import { validateApiKey } from "./install/validate-api-key.js";
import { writeSettings } from "./install/write-settings.js";
import type { InstallScope, SettingsTarget } from "./types/settings.js";
import type { GonkaGateModel } from "./install/models.js";
import type { TrackedLocalSettingsAction } from "./install/prompts.js";

const DEFAULT_COMMAND_NAME = "gonkagate-claude-code";

interface CliOptions {
  help: boolean;
  version: boolean;
  scope?: InstallScope;
  modelId?: string;
}

interface ParsedProgramOptions {
  scope?: InstallScope;
  model?: string;
}

interface ProgramOutput {
  writeOut?: (str: string) => void;
  writeErr?: (str: string) => void;
}

function rejectApiKeyArgs(argv: string[]): void {
  if (argv.some((arg) => arg === "--api-key" || arg.startsWith("--api-key="))) {
    throw new Error("Passing API keys via CLI arguments is intentionally unsupported. Run the installer interactively instead.");
  }
}

function createProgram(output?: ProgramOutput, commandName = DEFAULT_COMMAND_NAME): Command {
  const program = new Command()
    .name(commandName)
    .description("GonkaGate Claude Code installer")
    .addOption(
      new Option("--model <model-id>", "Skip the model prompt with a model id returned by /v1/models.")
    )
    .addOption(new Option("--scope <scope>", "Skip the scope prompt. Choose user or local.").choices(["user", "local"]))
    .helpOption("-h, --help", "Show this help.")
    .version("0.1.0", "-v, --version", "Show the package version.")
    .addHelpText(
      "after",
      `
Examples:
  npx @gonkagate/claude-code
  npx @gonkagate/claude-code-setup
  npx @gonkagate/claude-code --model <model-id>
  npx @gonkagate/claude-code --scope local

Models are fetched from https://api.gonkagate.com/v1/models with your GonkaGate API key.
`
    )
    .exitOverride();

  if (output) {
    program.configureOutput(output);
  }

  return program;
}

export function parseCliOptions(argv: string[], output?: ProgramOutput, commandName = DEFAULT_COMMAND_NAME): CliOptions {
  rejectApiKeyArgs(argv);

  const program = createProgram(output, commandName);
  program.parse(["node", commandName, ...argv]);

  const options = program.opts<ParsedProgramOptions>();
  return {
    help: false,
    version: false,
    scope: options.scope,
    modelId: options.model
  };
}

function getCommandNameFromArgv(): string {
  const commandName = process.argv[1] === undefined
    ? DEFAULT_COMMAND_NAME
    : basename(process.argv[1]).replace(/\.(?:js|ts)$/, "");
  return commandName === "cli" ? DEFAULT_COMMAND_NAME : commandName;
}

function printIntro(): void {
  console.log("Connect Claude Code to GonkaGate in one step.\n");
  console.log("This installer writes Claude Code settings for GonkaGate's public gateway.");
  console.log("Base URL is fixed to https://api.gonkagate.com and is not configurable.");
  console.log("Model choices are fetched from https://api.gonkagate.com/v1/models with your API key.\n");
}

function printSuccess(
  targetPath: string,
  scope: InstallScope,
  selectedModel: GonkaGateModel,
  backupPath?: string
): void {
  console.log("\nInstall complete.\n");
  console.log(`Updated: ${targetPath}`);
  console.log(`Model: ${selectedModel.name} (${selectedModel.id})`);

  if (backupPath) {
    console.log(`Backup: ${backupPath}`);
  }

  console.log("\nNext steps:");
  console.log("1. If Claude Code still shows direct Anthropic auth, run: claude auth logout");
  console.log("2. Start Claude Code normally: claude");
  console.log("3. In Claude Code, run: /status");
  console.log("4. Confirm the active gateway is https://api.gonkagate.com");

  if (scope === "local") {
    console.log("\nLocal scope reminder:");
    console.log("Keep .claude/settings.local.json uncommitted.");
  }
}

export async function resolveSettingsTarget(
  scope: InstallScope,
  cwd: string,
  chooseTrackedLocalSettingsAction: (relativeTargetPath: string) => Promise<TrackedLocalSettingsAction> =
    promptForTrackedLocalSettingsAction
): Promise<SettingsTarget> {
  const target = getSettingsTarget(scope, cwd);

  if (scope !== "local") {
    return target;
  }

  try {
    await ensureLocalSettingsIgnored(target.path);
    return target;
  } catch (error) {
    if (!(error instanceof TrackedLocalSettingsError)) {
      throw error;
    }

    const action = await chooseTrackedLocalSettingsAction(error.relativeTargetPath);

    if (action === "user") {
      console.log("\nSwitching to user scope so the repository stays unchanged.");
      return getSettingsTarget("user", cwd);
    }

    if (action === "cancel") {
      throw new Error("Installation cancelled.");
    }

    await stopTrackingLocalSettings(target.path);
    console.log(`\nStopped tracking ${error.relativeTargetPath} in git and added a local exclude.`);
    return target;
  }
}

export async function run(argv = process.argv.slice(2), commandName = getCommandNameFromArgv()): Promise<void> {
  const options = parseCliOptions(argv, undefined, commandName);

  printIntro();

  const apiKey = validateApiKey(await promptForApiKey());
  const models = await fetchGonkaGateModels(apiKey);
  const defaultModel = getDefaultModel(models);
  const selectedModel = options.modelId
    ? requireModelById(models, options.modelId)
    : await promptForModel(models, defaultModel.id);
  const requestedScope = options.scope ?? (await promptForScope("user"));
  const target = await resolveSettingsTarget(requestedScope, process.cwd());

  const loaded = await loadSettings(target.path);
  const mergedSettings = mergeSettingsWithGonkaEnv(loaded.settings, apiKey, selectedModel);
  const backupPath = loaded.exists ? await createBackup(target.path) : undefined;

  await writeSettings(target.path, mergedSettings);
  printSuccess(target.path, target.scope, selectedModel, backupPath);
}

function handleCliError(error: unknown): void {
  if (error instanceof CommanderError) {
    process.exitCode = error.exitCode;
    return;
  }

  const message = error instanceof Error ? error.message : String(error);
  console.error(`\nError: ${message}`);
  process.exitCode = 1;
}

const isEntrypoint = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntrypoint) {
  run().catch(handleCliError);
}
