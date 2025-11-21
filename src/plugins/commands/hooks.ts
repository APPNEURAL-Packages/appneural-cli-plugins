import chalk from "chalk";
import { PluginRegistry } from "../registry/index.js";
import { renderTable } from "../utils/cli.js";
import { log } from "../utils/logger.js";

export async function handleHooksList(registry: PluginRegistry) {
  await registry.load();
  renderTable(
    ["Plugin", "Hooks"],
    registry.list().map((record) => [chalk.bold(record.name), Object.keys(record.manifest.hooks ?? {}).join(", ") || "-"]),
  );
}

export async function handleHooksInspect(registry: PluginRegistry, pluginName: string) {
  await registry.load();
  const record = registry.find(pluginName);
  if (!record) {
    log.warn(`Plugin ${pluginName} not found.`);
    return;
  }
  renderTable(["Hook"], Object.keys(record.manifest.hooks ?? {}).map((hook) => [hook]));
}
