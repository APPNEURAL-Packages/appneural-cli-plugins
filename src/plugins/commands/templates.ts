import { PluginRegistry } from "../registry/index.js";
import { renderTable, withSpinner } from "../utils/cli.js";
import { log } from "../utils/logger.js";

export async function handleTemplates(registry: PluginRegistry) {
  await withSpinner("Loading plugins", async () => registry.load());
  renderTable(
    ["Plugin", "Templates"],
    registry.list().map((record) => [record.name, (record.manifest.templates ?? []).length]),
  );
}

export async function handleTemplatesList(registry: PluginRegistry) {
  await withSpinner("Loading plugins", async () => registry.load());
  const items = registry
    .list()
    .flatMap((p) => p.manifest.templates ?? [])
    .map((t) => t.name);
  renderTable(["Template"], items.map((name) => [name]));
}

export async function handleTemplatesInstall(templateName: string) {
  log.info(`Installing template ${templateName} (stub).`);
}
