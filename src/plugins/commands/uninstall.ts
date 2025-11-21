import { PluginRegistry } from "../registry/index.js";
import { withSpinner } from "../utils/cli.js";
import { log } from "../utils/logger.js";

export async function handleUninstall(registry: PluginRegistry, pluginName: string, options: { workspace?: boolean }) {
  await withSpinner(`Uninstalling ${pluginName}`, async () => {
    await registry.uninstall(pluginName, options.workspace ? "workspace" : "global");
  });
  log.success(`Uninstalled ${pluginName}`);
}
