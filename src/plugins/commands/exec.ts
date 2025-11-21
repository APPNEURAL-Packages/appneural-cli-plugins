import { execa } from "execa";
import { PluginRegistry } from "../registry/index.js";
import { log } from "../utils/logger.js";

export async function handleExec(registry: PluginRegistry, pluginName: string, args: string[]) {
  await registry.load();
  const record = registry.find(pluginName);
  if (!record) {
    log.warn(`Plugin ${pluginName} not found.`);
    return;
  }
  await execa("node", ["index.js", ...(args ?? [])], { cwd: record.location, stdio: "inherit" });
}
