import os from "node:os";
import path from "node:path";

const home = os.homedir();

export const PLUGIN_GLOBAL_ROOT = path.join(home, ".appneural", "plugins");
export const PLUGIN_WORKSPACE_ROOT = path.join(process.cwd(), ".anx", "plugins");
export const PLUGIN_CACHE_ROOT = path.join(home, ".cache", "appneural", "plugins");
export const REGISTRY_FILE = path.join(PLUGIN_GLOBAL_ROOT, "registry.json");

export function resolvePluginInstallPath(name: string, scope: "global" | "workspace" = "global"): string {
  const base = scope === "global" ? PLUGIN_GLOBAL_ROOT : PLUGIN_WORKSPACE_ROOT;
  return path.join(base, "node_modules", name);
}

export function resolveManifestCandidates(pluginPath: string): string[] {
  return [
    path.join(pluginPath, "appneural.plugin.mjs"),
    path.join(pluginPath, "appneural.plugin.js"),
    path.join(pluginPath, "dist", "index.js"),
    path.join(pluginPath, "index.js"),
  ];
}

export function pluginDataDir(pluginName: string): string {
  return path.join(PLUGIN_CACHE_ROOT, pluginName);
}
