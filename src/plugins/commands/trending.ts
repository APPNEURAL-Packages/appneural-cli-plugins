import { PluginRegistry } from "../registry/index.js";
import { renderTable, withSpinner } from "../utils/cli.js";
import { log } from "../utils/logger.js";

type ListType = "trending" | "recommended" | "featured" | "new" | "outdated";

export async function handleListType(registry: PluginRegistry, type: ListType) {
  const plugins = await withSpinner(`Loading ${type} plugins`, async () => {
    await registry.load();
    return registry.list().slice(0, 5);
  });

  if (!plugins.length) {
    log.info("No plugins installed.");
    return;
  }

  renderTable(
    ["Name", "Version", "Status"],
    plugins.map((p) => [p.name, p.version, type]),
  );
}
