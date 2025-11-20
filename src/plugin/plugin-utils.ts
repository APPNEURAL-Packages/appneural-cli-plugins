import fs from "fs/promises";
import path from "path";
import { pathToFileURL } from "url";
import type {
  PluginManifest,
  PluginModuleShape,
  AppneuralPluginDefinition,
  PluginCandidate,
  PluginSource,
  PluginRuntimeType
} from "./plugin-types.js";
import { logger } from "@appneural/cli-shared";

export async function fileExists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

export async function readPackageManifest(packageRoot: string): Promise<PluginManifest | null> {
  try {
    const contents = await fs.readFile(path.join(packageRoot, "package.json"), "utf-8");
    const parsed = JSON.parse(contents);
    if (typeof parsed.name !== "string" || typeof parsed.version !== "string") {
      return null;
    }
    return {
      name: parsed.name,
      version: parsed.version,
      description: typeof parsed.description === "string" ? parsed.description : undefined
    };
  } catch {
    return null;
  }
}

export async function resolveEntryFile(packageRoot: string, pkg?: Record<string, unknown>): Promise<string | null> {
  const candidates = [
    typeof pkg?.module === "string" ? (pkg.module as string) : undefined,
    typeof pkg?.main === "string" ? (pkg.main as string) : undefined,
    "dist/index.mjs",
    "dist/index.js",
    "index.mjs",
    "index.js"
  ].filter(Boolean) as string[];

  for (const rel of candidates) {
    const abs = path.join(packageRoot, rel);
    if (await isFile(abs)) {
      return abs;
    }
  }
  const fallback = path.join(packageRoot, "index.js");
  if (await isFile(fallback)) {
    return fallback;
  }
  return null;
}

async function isFile(target: string): Promise<boolean> {
  try {
    const stat = await fs.stat(target);
    return stat.isFile();
  } catch {
    return false;
  }
}

export async function importPluginModule(entryFile: string): Promise<PluginModuleShape | null> {
  try {
    const modulePath = entryFile.startsWith(".") || entryFile.startsWith("/") ? pathToFileURL(entryFile).href : entryFile;
    const imported = await import(modulePath);
    return imported as PluginModuleShape;
  } catch {
    return null;
  }
}

export function isValidPluginDefinition(subject: unknown): subject is AppneuralPluginDefinition {
  if (!subject || typeof subject !== "object") {
    return false;
  }
  const plugin = subject as Partial<AppneuralPluginDefinition>;
  return (
    typeof plugin.name === "string" &&
    typeof plugin.version === "string" &&
    typeof plugin.install === "function"
  );
}

export interface BuildCandidateOptions {
  packageRoot: string;
  source: PluginSource;
  pluginType: PluginRuntimeType;
  fallbackName?: string;
  fallbackVersion?: string;
}

export async function buildPluginCandidate(options: BuildCandidateOptions): Promise<PluginCandidate | null> {
  const manifest = await readPackageManifest(options.packageRoot);
  const pkgJson = await loadRawPackage(options.packageRoot);
  const entryFile = await resolveEntryFile(options.packageRoot, pkgJson ?? undefined);
  if (!entryFile) {
    logger.warn(`APPNEURAL plugin missing entry file at ${options.packageRoot}`);
    return null;
  }
  const name = manifest?.name ?? options.fallbackName ?? path.basename(options.packageRoot);
  if (!name) {
    return null;
  }
  const version =
    manifest?.version ?? options.fallbackVersion ?? (options.pluginType === "local" ? "0.0.0-local" : undefined);
  return {
    name,
    version,
    description: manifest?.description,
    packageRoot: options.packageRoot,
    entryFile,
    source: options.source,
    pluginType: options.pluginType
  };
}

export async function loadRawPackage(packageRoot: string): Promise<Record<string, unknown> | null> {
  try {
    const content = await fs.readFile(path.join(packageRoot, "package.json"), "utf-8");
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function getPluginPriority(type: PluginRuntimeType): number {
  switch (type) {
    case "local":
      return 3;
    case "npm":
      return 2;
    case "global":
    default:
      return 1;
  }
}
