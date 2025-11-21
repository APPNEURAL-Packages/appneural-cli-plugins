import { PluginRegistry } from "../registry/index.js";
import { withSpinner } from "../utils/cli.js";
import { log } from "../utils/logger.js";

export async function handleVerify(registry: PluginRegistry, pluginName: string) {
  const exists = await withSpinner("Loading plugin", async () => {
    await registry.load();
    return registry.find(pluginName);
  });
  if (!exists) {
    log.warn(`Plugin ${pluginName} not found.`);
    return;
  }
  log.success(`Signature for ${pluginName} verified (stub).`);
}
