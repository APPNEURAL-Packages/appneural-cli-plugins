import { PluginRegistry } from "../registry/index.js";
import { log } from "../utils/logger.js";

type DebugType = "debug" | "log" | "trace";

export async function handleDebug(registry: PluginRegistry, pluginName: string, type: DebugType) {
  await registry.load();
  if (!registry.find(pluginName)) {
    log.warn(`Plugin ${pluginName} not found.`);
    return;
  }
  log.info(`${type} output for ${pluginName} (stub).`);
}
