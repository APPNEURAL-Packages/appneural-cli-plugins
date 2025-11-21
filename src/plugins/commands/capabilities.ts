import chalk from "chalk";
import { PluginRegistry } from "../registry/index.js";
import { renderTable, withSpinner } from "../utils/cli.js";
import { log } from "../utils/logger.js";

export async function handleCapabilities(registry: PluginRegistry, pluginName: string) {
  const record = await withSpinner("Loading plugin", async () => {
    await registry.load();
    return registry.find(pluginName);
  });
  if (!record) {
    log.warn(`Plugin ${pluginName} not found.`);
    return;
  }
  renderTable(
    ["Type", "Items"],
    [
      ["Commands", (record.manifest.commands ?? []).map((c) => c.name).join(", ") || "-"],
      ["Tools", (record.manifest.tools ?? []).map((c) => c.name).join(", ") || "-"],
      ["Apps", (record.manifest.apps ?? []).map((c) => c.name).join(", ") || "-"],
      ["Templates", (record.manifest.templates ?? []).map((c) => c.name).join(", ") || "-"],
      ["Engines", (record.manifest.engines ?? []).map((c) => c.name).join(", ") || "-"],
      ["Agents", (record.manifest.agents ?? []).map((c) => c.name).join(", ") || "-"],
    ],
  );
}

export async function handleCapabilitiesAll(registry: PluginRegistry) {
  await withSpinner("Loading plugins", async () => {
    await registry.load();
  });
  renderTable(
    ["Plugin", "Commands", "Tools", "Apps"],
    registry.list().map((record) => [
      chalk.bold(record.name),
      (record.manifest.commands ?? []).length,
      (record.manifest.tools ?? []).length,
      (record.manifest.apps ?? []).length,
    ]),
  );
}
