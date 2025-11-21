import { PluginLoader } from "../loader/plugin-loader.js";
import { withSpinner } from "../utils/cli.js";
import { log } from "../utils/logger.js";

export async function handleReload(loader: PluginLoader) {
  await withSpinner("Reloading plugins", async () => {
    await loader.reload();
  });
  log.success("Plugins reloaded.");
}
