import { execa } from "execa";
import { PluginRegistry } from "../registry/index.js";
import { withSpinner } from "../utils/cli.js";
import { log } from "../utils/logger.js";

export async function handleTest(registry: PluginRegistry, pluginName: string) {
  await registry.load();
  const record = registry.find(pluginName);
  if (!record) {
    log.warn(`Plugin ${pluginName} not found.`);
    return;
  }
  await withSpinner(`Testing ${pluginName}`, async () => {
    await execa("npm", ["test"], { cwd: record.location, stdio: "inherit" });
  });
}
