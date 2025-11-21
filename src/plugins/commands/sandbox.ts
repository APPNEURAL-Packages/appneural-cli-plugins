import { PluginRegistry } from "../registry/index.js";
import { log } from "../utils/logger.js";
import { renderTable, withSpinner } from "../utils/cli.js";

export async function handleSandbox(registry: PluginRegistry, pluginName: string) {
  const record = await withSpinner("Loading plugin", async () => {
    await registry.load();
    return registry.find(pluginName);
  });
  if (!record) {
    log.warn(`Plugin ${pluginName} not found.`);
    return;
  }
  renderTable(
    ["Property", "Value"],
    [
      ["Sandboxed", record.manifest.permissions?.includes("sandbox:escape") ? "no" : "yes"],
      ["Permissions", (record.manifest.permissions ?? []).join(", ") || "-"],
    ],
  );
}
