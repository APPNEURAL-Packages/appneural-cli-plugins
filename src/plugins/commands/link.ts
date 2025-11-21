import path from "node:path";
import { PluginRegistry } from "../registry/index.js";
import { withSpinner } from "../utils/cli.js";
import { log } from "../utils/logger.js";

export async function handleLink(registry: PluginRegistry, pluginPath: string) {
  const absolutePath = path.resolve(pluginPath);
  await withSpinner(`Linking plugin from ${absolutePath}`, async () => {
    await registry.link(path.basename(absolutePath), absolutePath);
  });
  log.success(`Linked plugin from ${absolutePath}`);
}
