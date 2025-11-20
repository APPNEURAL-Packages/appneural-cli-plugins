import { Command } from "commander";
import fs from "fs/promises";
import path from "path";
import { execa } from "execa";
import chalk from "chalk";
import { logger } from "@appneural/cli-shared";
import { getPluginStatuses, reloadPlugins } from "../plugin/plugin-loader.js";
import type { PluginCandidate, PluginStatus } from "../plugin/plugin-types.js";
import { fileExists, loadRawPackage } from "../plugin/plugin-utils.js";
import { getCustomPluginDirectory } from "../plugin/plugin-context.js";
import { watchLocalPlugins } from "../plugin/plugin-watcher.js";
import { getGlobalConfigDir } from "@appneural/cli-shared";
import { registerPluginCreateCommand } from "../plugin/plugin-create.js";

const PLUGIN_CONFIG_FILE = "appneural.plugins.json";
const GLOBAL_PLUGIN_CONFIG_DIR = getGlobalConfigDir();
const GLOBAL_PLUGIN_CONFIG_PATH = path.join(GLOBAL_PLUGIN_CONFIG_DIR, PLUGIN_CONFIG_FILE);

interface PluginConfig {
  plugins: string[];
}

function configPath(): string {
  return GLOBAL_PLUGIN_CONFIG_PATH;
}

async function ensurePluginConfigDirectory(): Promise<void> {
  await fs.mkdir(GLOBAL_PLUGIN_CONFIG_DIR, { recursive: true });
}

async function readPluginConfig(): Promise<PluginConfig> {
  try {
    const content = await fs.readFile(configPath(), "utf-8");
    const parsed = JSON.parse(content) as PluginConfig;
    if (!Array.isArray(parsed.plugins)) {
      return { plugins: [] };
    }
    return parsed;
  } catch {
    return { plugins: [] };
  }
}

async function writePluginConfig(config: PluginConfig): Promise<void> {
  await ensurePluginConfigDirectory();
  await fs.writeFile(configPath(), JSON.stringify(config, null, 2), "utf-8");
}

async function ensureCustomPluginDirectory(): Promise<string> {
  const directory = getCustomPluginDirectory();
  await fs.mkdir(directory, { recursive: true });
  return directory;
}

async function ensurePluginListed(pkg: string): Promise<void> {
  const config = await readPluginConfig();
  if (!config.plugins.includes(pkg)) {
    config.plugins.push(pkg);
    await writePluginConfig(config);
  }
}

async function removePluginFromConfig(pkg: string): Promise<void> {
  const config = await readPluginConfig();
  const next = config.plugins.filter((name) => name !== pkg);
  if (next.length !== config.plugins.length) {
    config.plugins = next;
    await writePluginConfig(config);
  }
}

async function installPackageGlobally(pkg: string): Promise<void> {
  logger.info(`Installing ${pkg} globally via npm`);
  await execa("npm", ["install", "--global", pkg], { stdio: "inherit", cwd: process.cwd() });
}

async function uninstallPackageGlobally(pkg: string): Promise<void> {
  logger.info(`Uninstalling ${pkg} globally via npm`);
  await execa("npm", ["uninstall", "--global", pkg], { stdio: "inherit", cwd: process.cwd() });
}

async function readPluginCommands(plugin: PluginCandidate): Promise<string[]> {
  try {
    const manifest = await loadRawPackage(plugin.packageRoot);
    const commands = (manifest as any)?.appneural?.commands;
    if (Array.isArray(commands)) {
      return commands.map((cmd) => String(cmd));
    }
    return [];
  } catch {
    return [];
  }
}

async function statInstallTime(plugin: PluginCandidate): Promise<string | null> {
  try {
    const stats = await fs.stat(plugin.packageRoot);
    return stats.mtime.toISOString();
  } catch {
    return null;
  }
}

export function registerPluginsCommands(program: Command): void {
  const root = program.command("plugins").alias("plugin").description("APPNEURAL plugin operations");

  root
    .command("list")
    .description("List discovered plugins")
    .action(() => {
      const statuses = getPluginStatuses();
      if (statuses.length === 0) {
        logger.warn("No APPNEURAL plugins detected. Try 'anx plugins reload'.");
        return;
      }
      statuses.forEach((status) => {
        const state = status.loaded ? "loaded" : `failed${status.error ? ` (${status.error})` : ""}`;
        logger.info(
          `${status.candidate.name} v${status.candidate.version ?? "0.0.0"} (${status.candidate.pluginType}) – ${state}`
        );
      });
    });

  root
    .command("info <name>")
    .description("Show plugin metadata")
    .action(async (name: string) => {
      const status = getPluginStatuses().find((entry) => entry.candidate.name === name);
      if (!status) {
        logger.warn(`Plugin '${name}' not found`);
        return;
      }

      const installTimestamp = status.installedAt ?? (await statInstallTime(status.candidate)) ?? "unknown";
      logger.info(`Name: ${status.candidate.name}`);
      logger.info(`Version: ${status.candidate.version ?? "unknown"}`);
      logger.info(`Type: ${status.candidate.pluginType}`);
      logger.info(`Path: ${status.candidate.packageRoot}`);
      logger.info(`Loaded: ${status.loaded ? "yes" : "no"}`);
      if (status.error) {
        logger.warn(`Last error: ${status.error}`);
      }
      logger.info(`Install time: ${installTimestamp}`);
      const commands = await readPluginCommands(status.candidate);
      if (commands.length > 0) {
        logger.info(`Commands: ${commands.join(", ")}`);
      } else {
        logger.info("Commands: none reported");
      }
    });

  root
    .command("reload")
    .description("Reload the plugin system")
    .action(async () => {
      await reloadPlugins(program);
      logger.success("APPNEURAL plugins reloaded");
    });

  root
    .command("watch")
    .description("Watch local workspace plugins and hot-reload on change")
    .action(async () => {
      logger.info("Starting local plugin watcher...");
      await watchLocalPlugins(program);
      logger.info("Plugin watcher stopped");
    });

  root
    .command("doctor")
    .description("Validate plugin health")
    .action(async () => {
      const statuses = getPluginStatuses();
      if (statuses.length === 0) {
        logger.warn("No plugins to diagnose");
        return;
      }
      let issues = 0;

      const nameCounts = new Map<string, number>();
      statuses.forEach((status) => nameCounts.set(status.candidate.name, (nameCounts.get(status.candidate.name) ?? 0) + 1));
      nameCounts.forEach((count, name) => {
        if (count > 1) {
          issues += 1;
          logger.warn(`Duplicate plugin detected: ${name} (count: ${count})`);
        }
      });

      for (const status of statuses) {
        if (!(await fileExists(status.candidate.entryFile))) {
          issues += 1;
          logger.warn(`Missing entry file for ${status.candidate.name}: ${status.candidate.entryFile}`);
        }
        if (!status.loaded) {
          issues += 1;
          logger.warn(`Plugin not loaded: ${status.candidate.name} -> ${status.error ?? "unknown error"}`);
        }
        try {
          await execa("node", ["--check", status.candidate.entryFile]);
        } catch (error) {
          issues += 1;
          logger.warn(
            `Syntax check failed for ${status.candidate.name}: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
      }

      if (issues === 0) {
        logger.success("Plugin doctor completed with no issues");
      } else {
        logger.warn(`Plugin doctor detected ${issues} issue(s)`);
      }
    });

  root
    .command("add <package>")
    .description("Install an npm plugin and reload")
    .action(async (pkg: string) => {
      const customDirectory = await ensureCustomPluginDirectory();
      logger.info(`Installing ${pkg} via npm into ${customDirectory}`);
      await execa("npm", ["install", pkg, "--prefix", customDirectory], { stdio: "inherit", cwd: process.cwd() });
      await installPackageGlobally(pkg);
      await ensurePluginListed(pkg);
      await reloadPlugins(program, { logPluginLifecycle: true });
      logPluginInfo(pkg);
      logger.success(`Plugin ${pkg} installed and plugins reloaded`);
    });

  root
    .command("remove <package>")
    .description("Uninstall an npm plugin")
    .action(async (pkg: string) => {
      const customDirectory = getCustomPluginDirectory();
      if (!(await fileExists(customDirectory))) {
        logger.warn(`No custom plugin directory found at ${customDirectory}. Nothing to uninstall.`);
        return;
      }
      logger.info(`Uninstalling ${pkg} from ${customDirectory}`);
      await execa("npm", ["uninstall", pkg, "--prefix", customDirectory], { stdio: "inherit", cwd: process.cwd() });
      await uninstallPackageGlobally(pkg);
      await removePluginFromConfig(pkg);
      await reloadPlugins(program);
      logger.success(`Plugin ${pkg} removed and plugins reloaded`);
    });

  root
    .command("push <pluginName>")
    .description("Push the local plugin repo to GitHub (APPNEURAL-Packages org)")
    .action(async (pluginName: string) => {
      const DIR_NAME = `appneural-${pluginName}`;
      const pluginPath = path.resolve(DIR_NAME);
      const repoName = `APPNEURAL-Packages/${DIR_NAME}`;
      const DESCRIPTION = `${pluginName} plugin for APPNEURAL CLI`;
      try {
        // Check if repo already exists
        const viewResult = await execa("gh", ["repo", "view", repoName], { cwd: pluginPath });
        if (viewResult.exitCode === 0) {
          logger.warn(`⏭️  Skipping push: ${pluginName} (repo already exists)`);
          return;
        }
      } catch {
        // Repo does not exist, proceed to create and push
        logger.info(`🌐 Creating GitHub repo: ${repoName}`);
        await execa("gh", ["repo", "create", repoName, "--private", "--source=.", "--remote=origin", "--description", DESCRIPTION, "--push"], { cwd: pluginPath, stdio: "inherit" });
        logger.success(`Plugin ${pluginName} pushed to GitHub!`);
      }
    });

  root
    .command("publish <pluginName>")
    .description("Publish the plugin to npm (public)")
    .action(async (pluginName: string) => {
      const DIR_NAME = `appneural-${pluginName}`;
      const pluginPath = path.resolve(DIR_NAME);
      try {
        await execa("npm", ["version", "patch"], { cwd: pluginPath, stdio: "inherit" });
        await execa("npm", ["publish", "--access", "public"], { cwd: pluginPath, stdio: "inherit" });
        logger.success(`Plugin ${pluginName} published to npm!`);
      } catch (err) {
        logger.error(`Failed to publish plugin: ${err}`);
      }
    });

  // Register plugin create command under the plugin root group
  if (typeof registerPluginCreateCommand === "function") {
    registerPluginCreateCommand(root);
  }
}

function logPluginInfo(pkg: string): void {
  const status = getPluginStatuses().find((entry) => entry.candidate.name === pkg);
  if (!status) {
    return;
  }
  if (status.loaded) {
    // const durationSegment =
    //   typeof status.durationMs === "number" ? ` in ${status.durationMs}ms` : "";
    // logger.info(
    //   `${chalk.green("✔")} Loaded plugin: ${status.candidate.name} (${status.candidate.pluginType})${durationSegment}`
    // );
    // logger.info(
    //   `${chalk.cyan("ℹ")} Source: ${status.candidate.source} | Path: ${status.candidate.packageRoot}`
    // );
  } else {
    logger.warn(
      `${chalk.yellow("⚠")} Plugin ${status.candidate.name} failed to load: ${status.error ?? "unknown error"}`
    );
  }
}
