import { PluginRegistry } from "../registry/index.js";
import { withSpinner } from "../utils/cli.js";
import { log } from "../utils/logger.js";

export async function handleInstall(registry: PluginRegistry, pluginName: string, options: { workspace?: boolean }) {
  await withSpinner(`Installing ${pluginName}`, async () => {
    await registry.install(pluginName, options.workspace ? "workspace" : "global");
  });
  log.success(`Installed ${pluginName}`);
}
