import { Command } from "commander";
import chalk from "chalk";
import path from "node:path";
import { execa } from "execa";
import { PluginRegistry } from "../registry/index.js";
import { autoRegisterCommands } from "./router.js";
import { ensurePluginRoot, loadPlugin } from "../loader/index.js";
import { log, formatList } from "../utils/logger.js";
import { ensureDir, pathExists, readJSON, writeJSON } from "../utils/fs.js";
import { PLUGIN_CACHE_ROOT } from "../utils/paths.js";
import { PluginManifest, RegistryRecord } from "../utils/types.js";
import { writeFile } from "node:fs/promises";

const categoryCatalog = [
  { name: "ai", description: "AI assistants and automation", plugins: ["@appneural/plugin-ai"] },
  { name: "devtools", description: "Developer productivity and workflows", plugins: ["@appneural/plugin-devtools"] },
  { name: "data", description: "Data processing and analytics", plugins: ["@appneural/plugin-data"] },
];

async function bindInstalledPlugins(cli: Command, registry: PluginRegistry) {
  const installed = registry.list().filter((p) => p.enabled);
  for (const plugin of installed) {
    try {
      const loaded = await loadPlugin(plugin.name, {
        scope: plugin.source === "workspace" ? "workspace" : "global",
        sandbox: true,
      });
      autoRegisterCommands(cli, loaded.manifest, loaded.context);
      await registry.runHook(plugin.name, "onRegister");
      log.verbose(`Registered commands from ${plugin.name}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log.warn(`Failed to auto-register ${plugin.name}: ${message}`);
    }
  }
}

function printPlugin(record: RegistryRecord) {
  const status = record.enabled ? chalk.green("enabled") : chalk.gray("disabled");
  const source = chalk.yellow(record.source);
  console.log(`- ${chalk.bold(record.name)} @ ${record.version} (${status}, ${source})`);
}

async function createScaffold(name: string, targetDir: string) {
  const manifest: PluginManifest = {
    name,
    version: "0.1.0",
    description: `${name} plugin`,
    commands: [],
    tools: [],
    apps: [],
    templates: [],
    engines: [],
    agents: [],
    hooks: {},
    permissions: [],
  };

  await ensureDir(targetDir);
  const manifestPath = path.join(targetDir, "appneural.plugin.json");
  await writeJSON(manifestPath, manifest);
  const indexPath = path.join(targetDir, "index.js");
  const indexContent = [
    "export default {",
    `  name: "${name}",`,
    '  version: "0.1.0",',
    "  commands: [],",
    "  tools: [],",
    "  apps: [],",
    "  templates: [],",
    "  engines: [],",
    "  agents: [],",
    "  hooks: {},",
    "};",
    "",
  ].join("\n");
  await writeJSON(path.join(targetDir, "package.json"), {
    name,
    version: "0.1.0",
    type: "module",
    main: "./index.js",
    appneuralPlugin: manifest,
  });
  await ensureDir(path.dirname(indexPath));
  await writeFile(path.join(targetDir, "README.md"), `# ${name}\n\nGenerated anx plugin scaffold.\n`, "utf8");
  await writeTextFile(indexPath, indexContent);
}

async function writeTextFile(filePath: string, contents: string) {
  await ensureDir(path.dirname(filePath));
  await writeFile(filePath, contents, "utf8");
}

export async function registerPluginCommands(cli: Command) {
  await ensurePluginRoot("global");
  const registry = new PluginRegistry();
  await registry.load();

  // Auto-bind installed plugins
  await bindInstalledPlugins(cli, registry);

  const plugins = cli.command("plugins").description("Manage anx plugins");

  plugins
    .command("list")
    .description("List installed plugins")
    .option("--enabled", "Only show enabled plugins", false)
    .action(async (options) => {
      const pluginsList = registry.list().filter((p) => (options.enabled ? p.enabled : true));
      if (!pluginsList.length) {
        log.info("No plugins installed.");
        return;
      }
      pluginsList.forEach(printPlugin);
    });

  plugins
    .command("search <keyword>")
    .description("Search plugins")
    .action((keyword) => {
      const results = registry.search(keyword);
      if (!results.length) {
        log.info(`No plugins matched "${keyword}".`);
        return;
      }
      results.forEach(printPlugin);
    });

  plugins
    .command("info <pluginName>")
    .description("Show plugin information")
    .action(async (pluginName: string) => {
      const plugin = registry.find(pluginName);
      if (!plugin) {
        log.warn(`Plugin ${pluginName} not found in registry.`);
        return;
      }
      console.log(chalk.bold(plugin.name));
      console.log(`Version: ${plugin.version}`);
      console.log(`Source: ${plugin.source}`);
      console.log(`Enabled: ${plugin.enabled}`);
      console.log(`Commands: ${formatList(plugin.manifest.commands?.map((c) => c.name) ?? [])}`);
      console.log(`Tools: ${formatList(plugin.manifest.tools?.map((t) => t.name) ?? [])}`);
      console.log(`Apps: ${formatList(plugin.manifest.apps?.map((a) => a.name) ?? [])}`);
      console.log(`Templates: ${formatList(plugin.manifest.templates?.map((t) => t.name) ?? [])}`);
    });

  plugins
    .command("doctor")
    .description("Run plugin diagnostics")
    .action(async () => {
      const issues: string[] = [];
      if (!(await pathExists(PLUGIN_CACHE_ROOT))) {
        issues.push("Plugin cache directory missing.");
      }
      if (!(await pathExists(registry.list()[0]?.location ?? ""))) {
        // skip
      }
      if (issues.length) {
        issues.forEach((issue) => log.warn(issue));
      } else {
        log.success("Plugin system looks good.");
      }
    });

  plugins
    .command("install <pluginName>")
    .description("Install a plugin")
    .option("--workspace", "Install into workspace")
    .action(async (pluginName: string, options: { workspace?: boolean }) => {
      await registry.install(pluginName, options.workspace ? "workspace" : "global");
      log.success(`Installed ${pluginName}`);
    });

  plugins
    .command("uninstall <pluginName>")
    .description("Uninstall a plugin")
    .option("--workspace", "Uninstall from workspace")
    .action(async (pluginName: string, options: { workspace?: boolean }) => {
      await registry.uninstall(pluginName, options.workspace ? "workspace" : "global");
      log.success(`Uninstalled ${pluginName}`);
    });

  plugins
    .command("update [pluginName]")
    .description("Update a plugin or all plugins")
    .option("--all", "Update all installed plugins")
    .action(async (pluginName: string | undefined, options: { all?: boolean }) => {
      if (options.all) {
        const pluginsList = registry.list();
        for (const item of pluginsList) {
          await registry.update(item.name);
          log.success(`Updated ${item.name}`);
        }
        return;
      }
      if (!pluginName) {
        log.error("Provide a plugin name or use --all");
        return;
      }
      await registry.update(pluginName);
      log.success(`Updated ${pluginName}`);
    });

  plugins
    .command("enable <pluginName>")
    .description("Enable a plugin")
    .action(async (pluginName: string) => {
      await registry.enable(pluginName);
      log.success(`Enabled ${pluginName}`);
    });

  plugins
    .command("disable <pluginName>")
    .description("Disable a plugin")
    .action(async (pluginName: string) => {
      await registry.disable(pluginName);
      log.success(`Disabled ${pluginName}`);
    });

  plugins
    .command("create <pluginName>")
    .description("Create a new plugin scaffold")
    .option("-d, --dir <path>", "Target directory")
    .action(async (pluginName: string, options: { dir?: string }) => {
      const target = options.dir ? path.resolve(options.dir) : path.join(process.cwd(), pluginName);
      await createScaffold(pluginName, target);
      log.success(`Created plugin scaffold at ${target}`);
    });

  plugins
    .command("link <path>")
    .description("Link a local plugin")
    .action(async (targetPath: string) => {
      const absolutePath = path.resolve(targetPath);
      await registry.link(path.basename(absolutePath), absolutePath);
      log.success(`Linked plugin from ${absolutePath}`);
    });

  plugins
    .command("unlink <pluginName>")
    .description("Unlink a local plugin")
    .action(async (pluginName: string) => {
      await registry.unlink(pluginName);
      log.success(`Unlinked ${pluginName}`);
    });

  plugins
    .command("build <pluginName>")
    .description("Build a plugin")
    .action(async (pluginName: string) => {
      const record = registry.find(pluginName);
      if (!record) {
        log.warn(`Plugin ${pluginName} not found.`);
        return;
      }
      await execa("npm", ["run", "build"], { cwd: record.location, stdio: "inherit" });
    });

  plugins
    .command("dev <pluginName>")
    .description("Start plugin dev mode")
    .action(async (pluginName: string) => {
      const record = registry.find(pluginName);
      if (!record) {
        log.warn(`Plugin ${pluginName} not found.`);
        return;
      }
      await execa("npm", ["run", "dev"], { cwd: record.location, stdio: "inherit" });
    });

  plugins
    .command("test <pluginName>")
    .description("Run plugin tests")
    .action(async (pluginName: string) => {
      const record = registry.find(pluginName);
      if (!record) {
        log.warn(`Plugin ${pluginName} not found.`);
        return;
      }
      await execa("npm", ["test"], { cwd: record.location, stdio: "inherit" });
    });

  plugins
    .command("validate <pluginName>")
    .description("Validate a plugin manifest")
    .action(async (pluginName: string) => {
      const record = registry.find(pluginName);
      if (!record) {
        log.warn(`Plugin ${pluginName} not found.`);
        return;
      }
      const manifest = record.manifest;
      if (manifest.name && manifest.version) {
        log.success(`Manifest for ${pluginName} is valid.`);
      } else {
        log.error(`Manifest for ${pluginName} is missing required fields.`);
      }
    });

  plugins
    .command("pack <pluginName>")
    .description("Create a tarball for a plugin")
    .action(async (pluginName: string) => {
      const record = registry.find(pluginName);
      if (!record) {
        log.warn(`Plugin ${pluginName} not found.`);
        return;
      }
      await execa("npm", ["pack"], { cwd: record.location, stdio: "inherit" });
    });

  plugins
    .command("publish <pluginName>")
    .description("Publish a plugin")
    .option("--beta", "Publish with beta tag")
    .option("--canary", "Publish with canary tag")
    .action(async (pluginName: string, options: { beta?: boolean; canary?: boolean }) => {
      const record = registry.find(pluginName);
      if (!record) {
        log.warn(`Plugin ${pluginName} not found.`);
        return;
      }
      const tag = options.beta ? "beta" : options.canary ? "canary" : "latest";
      await execa("npm", ["publish", "--tag", tag], { cwd: record.location, stdio: "inherit" });
    });

  const generator = plugins.command("generate").description("Generate plugin components");

  ["tool", "command", "app", "template", "engine", "sdk", "agent"].forEach((type) => {
    generator
      .command(`${type} <name>`)
      .description(`Generate a ${type}`)
      .option("-p, --plugin <pluginName>", "Target plugin")
      .action(async (name: string, options: { plugin?: string }) => {
        const pluginName = options.plugin;
        if (!pluginName) {
          log.warn("Use --plugin to specify the target plugin.");
          return;
        }
        const record = registry.find(pluginName);
        if (!record) {
          log.warn(`Plugin ${pluginName} not found.`);
          return;
        }
        const targetDir = path.join(record.location, "generated", type);
        await ensureDir(targetDir);
        const filePath = path.join(targetDir, `${name}.md`);
        await writeTextFile(filePath, `# ${type}: ${name}\n`);
        log.success(`Generated ${type} "${name}" at ${filePath}`);
      });
  });

  plugins
    .command("categories")
    .description("List plugin categories")
    .action(() => {
      categoryCatalog.forEach((cat) => {
        console.log(`${chalk.bold(cat.name)}: ${cat.description}`);
      });
    });

  const category = plugins.command("category").description("Category operations");

  category
    .command("list")
    .description("List categories")
    .action(() => {
      categoryCatalog.forEach((cat) => console.log(`${chalk.bold(cat.name)} (${cat.plugins.length})`));
    });

  category
    .command("info <category>")
    .description("Category info")
    .action((categoryName: string) => {
      const cat = categoryCatalog.find((c) => c.name === categoryName);
      if (!cat) {
        log.warn(`Category ${categoryName} not found.`);
        return;
      }
      console.log(`${chalk.bold(cat.name)}: ${cat.description}`);
    });

  category
    .command("plugins <category>")
    .description("List plugins in a category")
    .action((categoryName: string) => {
      const cat = categoryCatalog.find((c) => c.name === categoryName);
      if (!cat) {
        log.warn(`Category ${categoryName} not found.`);
        return;
      }
      console.log(`${chalk.bold(cat.name)} plugins: ${formatList(cat.plugins)}`);
    });

  ["trending", "recommended", "featured", "new", "outdated"].forEach((name) => {
    plugins
      .command(name)
      .description(`${name} plugins`)
      .action(() => {
        const list = registry.list();
        if (!list.length) {
          log.info("No plugins installed.");
          return;
        }
        list.slice(0, 5).forEach(printPlugin);
      });
  });

  plugins
    .command("sandbox <pluginName>")
    .description("Inspect plugin sandbox")
    .action((pluginName: string) => {
      const record = registry.find(pluginName);
      if (!record) {
        log.warn(`Plugin ${pluginName} not found.`);
        return;
      }
      console.log(`Sandboxed: ${record.manifest.permissions?.includes("sandbox:escape") ? "no" : "yes"}`);
      console.log(`Permissions: ${formatList(record.manifest.permissions ?? [])}`);
    });

  plugins
    .command("permissions <pluginName>")
    .description("Show plugin permissions")
    .action((pluginName: string) => {
      const record = registry.find(pluginName);
      if (!record) {
        log.warn(`Plugin ${pluginName} not found.`);
        return;
      }
      console.log(formatList(record.manifest.permissions ?? []));
    });

  plugins
    .command("audit <pluginName>")
    .description("Audit plugin for common issues")
    .action((pluginName: string) => {
      const record = registry.find(pluginName);
      if (!record) {
        log.warn(`Plugin ${pluginName} not found.`);
        return;
      }
      console.log(`Audit for ${pluginName}:`);
      console.log(`- Permissions: ${formatList(record.manifest.permissions ?? [])}`);
      console.log(`- Commands: ${formatList(record.manifest.commands?.map((c) => c.name) ?? [])}`);
    });

  plugins
    .command("verify <pluginName>")
    .description("Verify plugin signature (stub)")
    .action((pluginName: string) => {
      if (!registry.find(pluginName)) {
        log.warn(`Plugin ${pluginName} not found.`);
        return;
      }
      log.success(`Signature for ${pluginName} verified (stub).`);
    });

  const cacheCmd = plugins.command("cache").description("Manage plugin cache");

  cacheCmd
    .command("clear")
    .description("Clear plugin cache")
    .action(async () => {
      await ensureDir(PLUGIN_CACHE_ROOT);
      await writeJSON(path.join(PLUGIN_CACHE_ROOT, "cache.json"), {});
      log.success("Cache cleared.");
    });

  cacheCmd
    .command("list")
    .description("List cache entries")
    .action(async () => {
      const cache = await readJSON<Record<string, unknown>>(path.join(PLUGIN_CACHE_ROOT, "cache.json"), {});
      console.log(cache);
    });

  plugins
    .command("reload")
    .description("Reload plugin registry")
    .action(async () => {
      await registry.load();
      await bindInstalledPlugins(cli, registry);
      log.success("Reloaded plugins.");
    });

  plugins
    .command("hooks list")
    .description("List plugin hooks")
    .action(() => {
      registry.list().forEach((record) => {
        console.log(`${chalk.bold(record.name)}: ${formatList(Object.keys(record.manifest.hooks ?? {}))}`);
      });
    });

  plugins
    .command("hooks inspect <pluginName>")
    .description("Inspect hooks for plugin")
    .action((pluginName: string) => {
      const record = registry.find(pluginName);
      if (!record) {
        log.warn(`Plugin ${pluginName} not found.`);
        return;
      }
      console.log(`${chalk.bold(pluginName)} hooks: ${formatList(Object.keys(record.manifest.hooks ?? {}))}`);
    });

  plugins
    .command("capabilities <pluginName>")
    .description("Show plugin capabilities")
    .action((pluginName: string) => {
      const record = registry.find(pluginName);
      if (!record) {
        log.warn(`Plugin ${pluginName} not found.`);
        return;
      }
      console.log(`Commands: ${formatList(record.manifest.commands?.map((c) => c.name) ?? [])}`);
      console.log(`Tools: ${formatList(record.manifest.tools?.map((t) => t.name) ?? [])}`);
      console.log(`Apps: ${formatList(record.manifest.apps?.map((a) => a.name) ?? [])}`);
    });

  plugins
    .command("capabilities all")
    .description("Show capabilities for all plugins")
    .action(() => {
      registry.list().forEach((record) => {
        console.log(`${chalk.bold(record.name)}: ${formatList(record.manifest.commands?.map((c) => c.name) ?? [])}`);
      });
    });

  plugins
    .command("add-to-workspace <pluginName>")
    .description("Add plugin to workspace")
    .action(async (pluginName: string) => {
      const record = registry.find(pluginName);
      if (!record) {
        log.warn(`Plugin ${pluginName} not found.`);
        return;
      }
      await registry.install(pluginName, "workspace");
      log.success(`Added ${pluginName} to workspace.`);
    });

  plugins
    .command("remove-from-workspace <pluginName>")
    .description("Remove plugin from workspace")
    .action(async (pluginName: string) => {
      await registry.uninstall(pluginName, "workspace");
      log.success(`Removed ${pluginName} from workspace.`);
    });

  plugins
    .command("sync")
    .description("Sync plugin registry")
    .action(async () => {
      await registry.save();
      log.success("Registry synced.");
    });

  plugins
    .command("run <pluginName> <command>")
    .description("Run a plugin command")
    .allowUnknownOption(true)
    .action(async (pluginName: string, commandName: string, args: string[]) => {
      const record = registry.find(pluginName);
      if (!record) {
        log.warn(`Plugin ${pluginName} not found.`);
        return;
      }
      const command = record.manifest.commands?.find((c) => c.name === commandName);
      if (!command || !command.action) {
        log.warn(`Command ${commandName} not found in ${pluginName}.`);
        return;
      }
      await command.action(args, {
        cwd: record.location,
        manifest: record.manifest,
        sandboxed: false,
        permissions: record.manifest.permissions ?? [],
      });
    });

  plugins
    .command("exec <pluginName> [args...]")
    .description("Execute a plugin entrypoint")
    .action(async (pluginName: string, args: string[]) => {
      const record = registry.find(pluginName);
      if (!record) {
        log.warn(`Plugin ${pluginName} not found.`);
        return;
      }
      await execa("node", ["index.js", ...(args ?? [])], { cwd: record.location, stdio: "inherit" });
    });

  ["debug", "log", "trace"].forEach((name) => {
    plugins
      .command(`${name} <pluginName>`)
      .description(`${name} a plugin`)
      .action((pluginName: string) => {
        if (!registry.find(pluginName)) {
          log.warn(`Plugin ${pluginName} not found.`);
          return;
        }
        log.info(`${name} output for ${pluginName} (stub).`);
      });
  });

  const migrate = plugins.command("migrate").description("Plugin migrations");

  migrate
    .command("list")
    .description("List migrations")
    .action(() => log.info("No migrations recorded (stub)."));

  migrate
    .command("run <file>")
    .description("Run a migration file")
    .action(async (file: string) => {
      log.info(`Running migration ${file} (stub).`);
    });

  migrate
    .command("<pluginName>")
    .description("Run migrations for a plugin")
    .action((pluginName: string) => {
      log.info(`Running migrations for ${pluginName} (stub).`);
    });

  const templates = plugins.command("templates").description("Plugin templates");

  templates
    .command("list")
    .description("List templates")
    .action(() => {
      const templatesSet = registry
        .list()
        .flatMap((p) => p.manifest.templates ?? [])
        .map((t) => t.name);
      console.log(formatList(templatesSet));
    });

  templates
    .command("install <templateName>")
    .description("Install a template")
    .action((templateName: string) => {
      log.info(`Installing template ${templateName} (stub).`);
    });

  plugins
    .command("marketplace")
    .description("Browse plugin marketplace")
    .action(() => {
      log.info("Opening marketplace (stub).");
    });

  plugins
    .command("marketplace search <keyword>")
    .description("Search marketplace")
    .action((keyword: string) => {
      log.info(`Searching marketplace for ${keyword} (stub).`);
    });

  return plugins;
}
