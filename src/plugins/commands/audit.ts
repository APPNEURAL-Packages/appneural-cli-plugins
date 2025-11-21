import { PluginRegistry } from "../registry/index.js";
import { renderTable, withSpinner } from "../utils/cli.js";
import { log } from "../utils/logger.js";

export async function handleAudit(registry: PluginRegistry, pluginName: string) {
  const record = await withSpinner("Loading plugin", async () => {
    await registry.load();
    return registry.find(pluginName);
  });
  if (!record) {
    log.warn(`Plugin ${pluginName} not found.`);
    return;
  }
  renderTable(
    ["Check", "Result"],
    [
      ["Permissions", (record.manifest.permissions ?? []).join(", ") || "none"],
      ["Commands", (record.manifest.commands ?? []).length],
      ["Tools", (record.manifest.tools ?? []).length],
    ],
  );
  log.success("Audit complete.");
}
