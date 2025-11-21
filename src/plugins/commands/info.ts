import chalk from "chalk";
import { PluginRegistry } from "../registry/index.js";
import { renderTable, withSpinner } from "../utils/cli.js";
import { log } from "../utils/logger.js";

export async function handleInfo(registry: PluginRegistry, pluginName: string) {
  const record = await withSpinner("Loading plugin info", async () => {
    await registry.load();
    return registry.find(pluginName);
  });

  if (!record) {
    log.warn(`Plugin ${pluginName} not found.`);
    return;
  }

  console.log(chalk.bold(record.name));
  console.log(`Version: ${record.version}`);
  console.log(`Source: ${record.source}`);
  console.log(`Enabled: ${record.enabled ? "yes" : "no"}`);

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
