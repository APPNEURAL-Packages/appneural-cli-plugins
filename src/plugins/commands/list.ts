import chalk from "chalk";
import { PluginRegistry } from "../registry/index.js";
import { renderTable, withSpinner } from "../utils/cli.js";
import { log } from "../utils/logger.js";

export async function handleList(registry: PluginRegistry, options: { enabled?: boolean }) {
  const plugins = await withSpinner("Loading plugins", async () => {
    await registry.load();
    return registry.list().filter((p) => (options.enabled ? p.enabled : true));
  });

  if (!plugins.length) {
    log.info("No plugins installed.");
    return;
  }

  renderTable(
    ["Name", "Version", "Source", "Enabled"],
    plugins.map((p) => [chalk.bold(p.name), p.version, p.source, p.enabled ? "yes" : "no"]),
  );
}
