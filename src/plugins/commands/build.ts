import { execa } from "execa";
import { PluginRegistry } from "../registry/index.js";
import { withSpinner } from "../utils/cli.js";
import { log } from "../utils/logger.js";

export async function handleBuild(registry: PluginRegistry, pluginName: string) {
  await registry.load();
  const record = registry.find(pluginName);
  if (!record) {
    log.warn(`Plugin ${pluginName} not found.`);
    return;
  }
  await withSpinner(`Building ${pluginName}`, async () => {
    await execa("npm", ["run", "build"], { cwd: record.location, stdio: "inherit" });
  });
}
