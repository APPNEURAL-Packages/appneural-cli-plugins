import { PluginRegistry } from "../registry/index.js";
import { withSpinner } from "../utils/cli.js";
import { log } from "../utils/logger.js";

export async function handleUpdate(registry: PluginRegistry, pluginName: string | undefined, options: { all?: boolean }) {
  await registry.load();
  if (options.all) {
    for (const plugin of registry.list()) {
      await withSpinner(`Updating ${plugin.name}`, async () => registry.update(plugin.name));
      log.success(`Updated ${plugin.name}`);
    }
    return;
  }

  if (!pluginName) {
    log.error("Provide a plugin name or use --all");
    return;
  }

  await withSpinner(`Updating ${pluginName}`, async () => registry.update(pluginName));
  log.success(`Updated ${pluginName}`);
}
