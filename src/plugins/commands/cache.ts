import path from "node:path";
import { PLUGIN_CACHE_ROOT } from "../utils/paths.js";
import { ensureDir, readJSON, writeJSON } from "../utils/fs.js";
import { withSpinner } from "../utils/cli.js";
import { log } from "../utils/logger.js";

export async function handleCacheClear() {
  await withSpinner("Clearing plugin cache", async () => {
    await ensureDir(PLUGIN_CACHE_ROOT);
    await writeJSON(path.join(PLUGIN_CACHE_ROOT, "cache.json"), {});
  });
  log.success("Cache cleared.");
}

export async function handleCacheList() {
  const cache = await readJSON<Record<string, unknown>>(path.join(PLUGIN_CACHE_ROOT, "cache.json"), {});
  console.dir(cache, { depth: null });
}
