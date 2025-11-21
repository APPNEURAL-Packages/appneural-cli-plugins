import { PluginRegistry } from "../registry/index.js";
import { renderTable, withSpinner } from "../utils/cli.js";
import { log } from "../utils/logger.js";

export async function handlePermissions(registry: PluginRegistry, pluginName: string) {
  const record = await withSpinner("Loading plugin", async () => {
    await registry.load();
    return registry.find(pluginName);
  });
  if (!record) {
    log.warn(`Plugin ${pluginName} not found.`);
    return;
  }
  renderTable(["Permission"], (record.manifest.permissions ?? []).map((p) => [p]));
}
