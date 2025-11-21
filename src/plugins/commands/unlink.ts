import { PluginRegistry } from "../registry/index.js";
import { withSpinner } from "../utils/cli.js";
import { log } from "../utils/logger.js";

export async function handleUnlink(registry: PluginRegistry, pluginName: string) {
  await withSpinner(`Unlinking ${pluginName}`, async () => registry.unlink(pluginName));
  log.success(`Unlinked ${pluginName}`);
}
