import { PluginRegistry } from "../registry/index.js";
import { withSpinner } from "../utils/cli.js";
import { log } from "../utils/logger.js";

export async function handleAddToWorkspace(registry: PluginRegistry, pluginName: string) {
  await withSpinner(`Adding ${pluginName} to workspace`, async () => {
    await registry.install(pluginName, "workspace");
  });
  log.success(`Added ${pluginName} to workspace.`);
}

export async function handleRemoveFromWorkspace(registry: PluginRegistry, pluginName: string) {
  await withSpinner(`Removing ${pluginName} from workspace`, async () => {
    await registry.uninstall(pluginName, "workspace");
  });
  log.success(`Removed ${pluginName} from workspace.`);
}

export async function handleSync(registry: PluginRegistry) {
  await withSpinner("Syncing registry", async () => registry.save());
  log.success("Registry synced.");
}
