import { execa } from "execa";
import { PluginRegistry } from "../registry/index.js";
import { withSpinner } from "../utils/cli.js";
import { log } from "../utils/logger.js";

export async function handlePublish(
  registry: PluginRegistry,
  pluginName: string,
  options: { beta?: boolean; canary?: boolean },
) {
  await registry.load();
  const record = registry.find(pluginName);
  if (!record) {
    log.warn(`Plugin ${pluginName} not found.`);
    return;
  }
  const tag = options.beta ? "beta" : options.canary ? "canary" : "latest";
  await withSpinner(`Publishing ${pluginName}`, async () => {
    await execa("npm", ["publish", "--tag", tag], { cwd: record.location, stdio: "inherit" });
  });
  log.success(`Published ${pluginName} with tag ${tag}`);
}
