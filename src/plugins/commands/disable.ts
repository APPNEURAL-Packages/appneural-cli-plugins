import { PluginRegistry } from "../registry/index.js";
import { withSpinner } from "../utils/cli.js";
import { log } from "../utils/logger.js";

export async function handleDisable(registry: PluginRegistry, pluginName: string) {
  await registry.load();
  await withSpinner(`Disabling ${pluginName}`, async () => registry.disable(pluginName));
  log.success(`Disabled ${pluginName}`);
}
