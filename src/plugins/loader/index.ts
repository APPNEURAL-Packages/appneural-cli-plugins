import { pathToFileURL } from "node:url";
import path from "node:path";
import { ensureDir, pathExists } from "../utils/fs.js";
import { PLUGIN_GLOBAL_ROOT, PLUGIN_WORKSPACE_ROOT, resolveManifestCandidates, resolvePluginInstallPath } from "../utils/paths.js";
import { log } from "../utils/logger.js";
import { PluginManifest, PluginRuntimeContext } from "../utils/types.js";
import { ManifestValidationError, PluginNotFoundError } from "../utils/errors.js";
import { validateManifest } from "../manifest/validator.js";
import { PluginSandbox } from "../sandbox/index.js";
import { executeHooks } from "../hooks/index.js";

export interface PluginLoadOptions {
  scope?: "global" | "workspace";
  sandbox?: boolean;
}

export interface LoadedPlugin {
  manifest: PluginManifest;
  module: Record<string, unknown>;
  context: PluginRuntimeContext;
  entry: string;
}

async function resolvePluginEntry(pluginName: string, scope: "global" | "workspace"): Promise<string> {
  const installPath = resolvePluginInstallPath(pluginName, scope);
  const manifestCandidates = resolveManifestCandidates(installPath);

  for (const candidate of manifestCandidates) {
    if (await pathExists(candidate)) {
      return candidate;
    }
  }

  throw new PluginNotFoundError(pluginName);
}

async function importPlugin(entry: string): Promise<Record<string, unknown>> {
  const url = pathToFileURL(entry).href;
  return import(url);
}

export async function loadPlugin(
  pluginName: string,
  options: PluginLoadOptions = {},
): Promise<LoadedPlugin> {
  const scope = options.scope ?? "global";
  const entry = await resolvePluginEntry(pluginName, scope);
  const module = await importPlugin(entry);
  const rawManifest = module.default ?? module.manifest ?? module.plugin;

  if (!rawManifest) {
    throw new ManifestValidationError(`Plugin "${pluginName}" did not export a manifest.`);
  }

  const manifest = validateManifest(rawManifest, pluginName);
  const context: PluginRuntimeContext = {
    cwd: path.dirname(entry),
    manifest,
    sandboxed: Boolean(options.sandbox),
    permissions: manifest.permissions ?? [],
    meta: {},
  };

  if (options.sandbox) {
    const sandbox = new PluginSandbox(manifest, context);
    sandbox.verifyPermissions();
    await sandbox.prepare();
    await executeHooks(manifest.hooks, "onLoad", context, sandbox);
  } else {
    await executeHooks(manifest.hooks, "onLoad", context);
  }

  return { manifest, module, context, entry };
}

export async function ensurePluginRoot(scope: "global" | "workspace" = "global") {
  const base = scope === "global" ? PLUGIN_GLOBAL_ROOT : PLUGIN_WORKSPACE_ROOT;
  await ensureDir(path.join(base, "node_modules"));
}

export { PluginLoader } from "./plugin-loader.js";
