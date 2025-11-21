import { PluginRegistry } from "../registry/index.js";
import { withSpinner } from "../utils/cli.js";
import { log } from "../utils/logger.js";

export async function handleEnable(registry: PluginRegistry, pluginName: string) {
  await registry.load();
  await withSpinner(`Enabling ${pluginName}`, async () => registry.enable(pluginName));
  log.success(`Enabled ${pluginName}`);
}
