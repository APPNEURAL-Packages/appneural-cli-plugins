import { execa } from "execa";
import { PluginRegistry } from "../registry/index.js";
import { withSpinner } from "../utils/cli.js";
import { log } from "../utils/logger.js";

export async function handlePack(registry: PluginRegistry, pluginName: string) {
  await registry.load();
  const record = registry.find(pluginName);
  if (!record) {
    log.warn(`Plugin ${pluginName} not found.`);
    return;
  }
  await withSpinner(`Packing ${pluginName}`, async () => {
    await execa("npm", ["pack"], { cwd: record.location, stdio: "inherit" });
  });
  log.success(`Created package for ${pluginName}`);
}
