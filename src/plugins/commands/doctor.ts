import { PluginRegistry } from "../registry/index.js";
import { PLUGIN_CACHE_ROOT, PLUGIN_GLOBAL_ROOT, PLUGIN_WORKSPACE_ROOT } from "../utils/paths.js";
import { renderTable, withSpinner } from "../utils/cli.js";
import { pathExists } from "../utils/fs.js";
import { log } from "../utils/logger.js";

export async function handleDoctor(registry: PluginRegistry) {
  const rows: Array<[string, string]> = [];

  await withSpinner("Running diagnostics", async () => {
    const cacheExists = await pathExists(PLUGIN_CACHE_ROOT);
    rows.push(["Cache directory", cacheExists ? "ok" : "missing"]);

    const globalDir = await pathExists(PLUGIN_GLOBAL_ROOT);
    rows.push(["Global plugins", globalDir ? "ok" : "missing"]);

    const workspaceDir = await pathExists(PLUGIN_WORKSPACE_ROOT);
    rows.push(["Workspace plugins", workspaceDir ? "ok" : "missing"]);

    await registry.load();
    const count = registry.list().length;
    rows.push(["Registered plugins", count.toString()]);
  });

  renderTable(["Check", "Status"], rows);
  log.success("Diagnostics complete");
}
