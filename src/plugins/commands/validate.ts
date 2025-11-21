import { PluginRegistry } from "../registry/index.js";
import { withSpinner } from "../utils/cli.js";
import { validateManifest } from "../manifest/validator.js";
import { log } from "../utils/logger.js";

export async function handleValidate(registry: PluginRegistry, pluginName: string) {
  await registry.load();
  const record = registry.find(pluginName);
  if (!record) {
    log.warn(`Plugin ${pluginName} not found.`);
    return;
  }
  await withSpinner(`Validating ${pluginName}`, async () => {
    validateManifest(record.manifest);
  });
  log.success(`Manifest for ${pluginName} is valid.`);
}
