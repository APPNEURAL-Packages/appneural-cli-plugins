import { Command } from "commander";
import { PluginLoader } from "../plugins/loader/plugin-loader.js";
import { PluginRegistry } from "../plugins/registry/index.js";
import { log } from "../plugins/utils/logger.js";
import { handleList } from "../plugins/commands/list.js";
import { handleSearch } from "../plugins/commands/search.js";
import { handleInfo } from "../plugins/commands/info.js";
import { handleDoctor } from "../plugins/commands/doctor.js";
import { handleInstall } from "../plugins/commands/install.js";
import { handleUninstall } from "../plugins/commands/uninstall.js";
import { handleUpdate } from "../plugins/commands/update.js";
import { handleEnable } from "../plugins/commands/enable.js";
import { handleDisable } from "../plugins/commands/disable.js";
import { handleCreate } from "../plugins/commands/create.js";
import { handleLink } from "../plugins/commands/link.js";
import { handleUnlink } from "../plugins/commands/unlink.js";
import { handleBuild } from "../plugins/commands/build.js";
import { handleDev } from "../plugins/commands/dev.js";
import { handleTest } from "../plugins/commands/test.js";
import { handleValidate } from "../plugins/commands/validate.js";
import { handlePack } from "../plugins/commands/pack.js";
import { handlePublish } from "../plugins/commands/publish.js";
import { handleGenerate } from "../plugins/commands/generate.js";
import { handleCategories, handleCategoryInfo, handleCategoryList, handleCategoryPlugins } from "../plugins/commands/categories.js";
import { handleListType } from "../plugins/commands/trending.js";
import { handleSandbox } from "../plugins/commands/sandbox.js";
import { handlePermissions } from "../plugins/commands/permissions.js";
import { handleAudit } from "../plugins/commands/audit.js";
import { handleVerify } from "../plugins/commands/verify.js";
import { handleCacheClear, handleCacheList } from "../plugins/commands/cache.js";
import { handleReload } from "../plugins/commands/reload.js";
import { handleHooksInspect, handleHooksList } from "../plugins/commands/hooks.js";
import { handleCapabilities, handleCapabilitiesAll } from "../plugins/commands/capabilities.js";
import { handleAddToWorkspace, handleRemoveFromWorkspace, handleSync } from "../plugins/commands/workspace.js";
import { handleRun } from "../plugins/commands/run.js";
import { handleExec } from "../plugins/commands/exec.js";
import { handleDebug } from "../plugins/commands/debug.js";
import { handleMigrate, handleMigrateList, handleMigrateRun } from "../plugins/commands/migrate.js";
import { handleTemplates, handleTemplatesInstall, handleTemplatesList } from "../plugins/commands/templates.js";
import { handleMarketplace, handleMarketplaceSearch } from "../plugins/commands/marketplace.js";

type AsyncAction = (...args: any[]) => Promise<void> | void;

const wrap = (fn: AsyncAction) => async (...args: any[]) => {
  try {
    await fn(...args);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error(message);
    process.exitCode = 1;
  }
};

export async function registerPluginCLI(program: Command) {
  const registry = new PluginRegistry();
  await registry.load();
  const loader = new PluginLoader({ cli: program });

  const plugins = program.command("plugins").description("Manage anx plugins");

  plugins.command("list").option("--enabled", "Only show enabled").action(wrap((options) => handleList(registry, options)));

  plugins.command("search <keyword>").description("Search plugins").action(wrap((keyword) => handleSearch(keyword)));

  plugins.command("info <pluginName>").description("Show plugin info").action(wrap((pluginName) => handleInfo(registry, pluginName)));

  plugins.command("doctor").description("Run diagnostics").action(wrap(() => handleDoctor(registry)));

  plugins
    .command("install <pluginName>")
    .description("Install a plugin")
    .option("--workspace", "Install to workspace")
    .action(wrap((pluginName, options) => handleInstall(registry, pluginName, options)));

  plugins
    .command("uninstall <pluginName>")
    .description("Uninstall a plugin")
    .option("--workspace", "Uninstall from workspace")
    .action(wrap((pluginName, options) => handleUninstall(registry, pluginName, options)));

  plugins
    .command("update [pluginName]")
    .description("Update plugin or all plugins")
    .option("--all", "Update all plugins")
    .action(wrap((pluginName, options) => handleUpdate(registry, pluginName, options)));

  plugins.command("enable <pluginName>").description("Enable a plugin").action(wrap((pluginName) => handleEnable(registry, pluginName)));
  plugins.command("disable <pluginName>").description("Disable a plugin").action(wrap((pluginName) => handleDisable(registry, pluginName)));

  plugins
    .command("create <pluginName>")
    .description("Create a plugin scaffold")
    .option("-d, --dir <dir>")
    .action(wrap(handleCreate));

  plugins.command("link <path>").description("Link a local plugin").action(wrap((pluginPath) => handleLink(registry, pluginPath)));

  plugins.command("unlink <pluginName>").description("Unlink a local plugin").action(wrap((pluginName) => handleUnlink(registry, pluginName)));

  plugins.command("build <pluginName>").description("Build a plugin").action(wrap((pluginName) => handleBuild(registry, pluginName)));
  plugins.command("dev <pluginName>").description("Run plugin dev mode").action(wrap((pluginName) => handleDev(registry, pluginName)));
  plugins.command("test <pluginName>").description("Run plugin tests").action(wrap((pluginName) => handleTest(registry, pluginName)));
  plugins.command("validate <pluginName>").description("Validate plugin manifest").action(wrap((pluginName) => handleValidate(registry, pluginName)));
  plugins.command("pack <pluginName>").description("Pack a plugin").action(wrap((pluginName) => handlePack(registry, pluginName)));
  plugins
    .command("publish <pluginName>")
    .description("Publish a plugin")
    .option("--beta", "Publish with beta tag")
    .option("--canary", "Publish with canary tag")
    .action(wrap((pluginName, options) => handlePublish(registry, pluginName, options)));

  const generate = plugins.command("generate").description("Generate plugin components");
  ["tool", "command", "app", "template", "engine", "sdk", "agent"].forEach((type) => {
    generate
      .command(`${type} <name>`)
      .option("-p, --plugin <pluginName>", "Target plugin")
      .description(`Generate a ${type}`)
      .action(wrap((name, options) => handleGenerate(type as any, name, options)));
  });

  plugins.command("categories").description("List plugin categories").action(wrap(handleCategories));
  const category = plugins.command("category").description("Category operations");
  category.command("list").action(wrap(handleCategoryList));
  category.command("info <category>").action(wrap((category) => handleCategoryInfo(category)));
  category.command("plugins <category>").action(wrap((category) => handleCategoryPlugins(category)));

  ["trending", "recommended", "featured", "new", "outdated"].forEach((name) => {
    plugins.command(name).description(`${name} plugins`).action(wrap(() => handleListType(registry, name as any)));
  });

  plugins.command("sandbox <pluginName>").description("Inspect plugin sandbox").action(wrap((pluginName) => handleSandbox(registry, pluginName)));
  plugins.command("permissions <pluginName>").description("Show plugin permissions").action(wrap((pluginName) => handlePermissions(registry, pluginName)));
  plugins.command("audit <pluginName>").description("Audit plugin").action(wrap((pluginName) => handleAudit(registry, pluginName)));
  plugins.command("verify <pluginName>").description("Verify plugin signature").action(wrap((pluginName) => handleVerify(registry, pluginName)));

  const cache = plugins.command("cache").description("Manage plugin cache");
  cache.command("clear").action(wrap(handleCacheClear));
  cache.command("list").action(wrap(handleCacheList));

  plugins.command("reload").description("Reload plugin registry").action(wrap(() => handleReload(loader)));

  const hooks = plugins.command("hooks").description("Hook inspection");
  hooks.command("list").action(wrap(() => handleHooksList(registry)));
  hooks.command("inspect <pluginName>").action(wrap((pluginName) => handleHooksInspect(registry, pluginName)));

  const capabilities = plugins.command("capabilities").description("Plugin capabilities");
  capabilities.command("<pluginName>").description("Show plugin capabilities").action(wrap((pluginName) => handleCapabilities(registry, pluginName)));
  capabilities.command("all").description("Show all plugin capabilities").action(wrap(() => handleCapabilitiesAll(registry)));

  plugins.command("add-to-workspace <pluginName>").action(wrap((pluginName) => handleAddToWorkspace(registry, pluginName)));
  plugins.command("remove-from-workspace <pluginName>").action(wrap((pluginName) => handleRemoveFromWorkspace(registry, pluginName)));
  plugins.command("sync").description("Sync registry").action(wrap(() => handleSync(registry)));

  plugins
    .command("run <pluginName> <command>")
    .allowUnknownOption(true)
    .description("Run plugin command")
    .action(wrap((pluginName, commandName, args) => handleRun(registry, pluginName, commandName, args)));

  plugins.command("exec <pluginName> [args...]").description("Execute plugin entry").action(wrap((pluginName, args) => handleExec(registry, pluginName, args)));

  ["debug", "log", "trace"].forEach((type) => {
    plugins.command(`${type} <pluginName>`).description(`${type} plugin`).action(wrap((pluginName) => handleDebug(registry, pluginName, type as any)));
  });

  const migrate = plugins.command("migrate").description("Plugin migrations");
  migrate.command("list").action(wrap(handleMigrateList));
  migrate.command("run <file>").action(wrap((file) => handleMigrateRun(file)));
  migrate.command("<pluginName>").action(wrap((pluginName) => handleMigrate(pluginName)));

  const templates = plugins.command("templates").description("Plugin templates").action(wrap(() => handleTemplates(registry)));
  templates.command("list").action(wrap(() => handleTemplatesList(registry)));
  templates.command("install <templateName>").action(wrap((templateName) => handleTemplatesInstall(templateName)));
  templates.command("show").description("Show templates per plugin").action(wrap(() => handleTemplates(registry)));

  const marketplace = plugins.command("marketplace").description("Plugin marketplace");
  marketplace.action(wrap(handleMarketplace));
  marketplace.command("search <keyword>").description("Search marketplace").action(wrap((keyword) => handleMarketplaceSearch(keyword)));

  // Load installed plugins to auto-register their commands
  try {
    await loader.loadAll();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.warn(`Failed to auto-register installed plugins: ${message}`);
  }
}
