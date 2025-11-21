import { PluginRegistry } from "../registry/index.js";
import { log } from "../utils/logger.js";

export async function handleRun(registry: PluginRegistry, pluginName: string, commandName: string, args: string[]) {
  await registry.load();
  const record = registry.find(pluginName);
  if (!record) {
    log.warn(`Plugin ${pluginName} not found.`);
    return;
  }
  const command = record.manifest.commands?.find((c) => c.name === commandName);
  if (!command || !command.action) {
    log.warn(`Command ${commandName} not found in ${pluginName}.`);
    return;
  }
  await command.action(args, {
    cwd: record.location,
    manifest: record.manifest,
    sandboxed: false,
    permissions: record.manifest.permissions ?? [],
  });
}
