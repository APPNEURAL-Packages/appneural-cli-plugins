import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { ManifestValidationError } from "../utils/errors.js";
import { resolveManifestCandidates } from "../utils/paths.js";
import { PluginManifest } from "../utils/types.js";
import { validateManifest } from "./validator.js";
import { pathExists } from "../utils/fs.js";

export async function loadManifestFromModule(entry: string): Promise<PluginManifest> {
  const moduleUrl = pathToFileURL(entry).href;
  const imported = await import(moduleUrl);
  const manifestCandidate: unknown = imported.default ?? imported.manifest ?? imported.plugin;

  if (!manifestCandidate || typeof manifestCandidate !== "object") {
    throw new ManifestValidationError(`No manifest export found in ${entry}`);
  }

  return validateManifest(manifestCandidate as Partial<PluginManifest>, entry);
}

export async function loadManifestFromPackage(pluginPath: string): Promise<PluginManifest> {
  for (const candidate of resolveManifestCandidates(pluginPath)) {
    if (await pathExists(candidate)) {
      return loadManifestFromModule(candidate);
    }
  }

  throw new ManifestValidationError(`Unable to resolve manifest at ${pluginPath}`);
}

export async function readPackageManifest(pluginPath: string): Promise<Partial<PluginManifest>> {
  const pkgPath = path.join(pluginPath, "package.json");
  try {
    const raw = await readFile(pkgPath, "utf8");
    const pkg = JSON.parse(raw);
    const embedded = pkg.appneuralPlugin ?? pkg.anxPlugin ?? {};
    if (embedded.name || embedded.commands) {
      return embedded as Partial<PluginManifest>;
    }
  } catch {
    // ignore
  }

  return {};
}
