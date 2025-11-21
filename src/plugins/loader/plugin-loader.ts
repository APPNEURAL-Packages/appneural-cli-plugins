import fs from "node:fs";
import path from "node:path";
import { stat } from "node:fs/promises";
import { Command } from "commander";
import chalk from "chalk";
import { autoRegisterCommands } from "../commands/router.js";
import { executeHooks } from "../hooks/index.js";
import { loadManifestFromPackage } from "../manifest/index.js";
import { PluginSandbox } from "../sandbox/index.js";
import { ensureDir, pathExists, readJSON, writeJSON } from "../utils/fs.js";
import { log } from "../utils/logger.js";
import { PLUGIN_CACHE_ROOT, PLUGIN_GLOBAL_ROOT, PLUGIN_WORKSPACE_ROOT, resolveManifestCandidates } from "../utils/paths.js";
import { PluginAgentSpec, PluginAppSpec, PluginEngineSpec, PluginManifest, PluginRuntimeContext, PluginTemplateSpec, PluginToolSpec, PluginSdkSpec } from "../utils/types.js";
import { validateManifest } from "../manifest/validator.js";

type PluginScope = "local" | "global";

export interface RegistrationTargets {
  registerTool?: (tool: PluginToolSpec, context: PluginRuntimeContext) => void;
  registerApp?: (app: PluginAppSpec, context: PluginRuntimeContext) => void;
  registerTemplate?: (template: PluginTemplateSpec, context: PluginRuntimeContext) => void;
  registerEngine?: (engine: PluginEngineSpec, context: PluginRuntimeContext) => void;
  registerAgent?: (agent: PluginAgentSpec, context: PluginRuntimeContext) => void;
  registerSdk?: (sdk: unknown, context: PluginRuntimeContext) => void;
}

interface CachedPluginEntry {
  name: string;
  scope: PluginScope;
  location: string;
  version?: string;
  mtime?: number;
}

interface PluginLoaderOptions extends RegistrationTargets {
  cli: Command;
  workspaceDir?: string;
  cacheTTL?: number;
  sandbox?: boolean;
}

interface LoadedPluginRecord {
  manifest: PluginManifest;
  context: PluginRuntimeContext;
  scope: PluginScope;
  location: string;
}

const CACHE_FILE = path.join(PLUGIN_CACHE_ROOT, "plugins.json");
const DEFAULT_CACHE_TTL = 30_000;

export class PluginLoader {
  private options: PluginLoaderOptions;
  private cache: CachedPluginEntry[] = [];
  private loaded = new Map<string, LoadedPluginRecord>();

  constructor(options: PluginLoaderOptions) {
    this.options = {
      workspaceDir: options.workspaceDir ?? process.cwd(),
      cacheTTL: options.cacheTTL ?? DEFAULT_CACHE_TTL,
      sandbox: options.sandbox ?? true,
      ...options,
    };
  }

  async loadAll(force = false) {
    await this.loadCache(force);
    const candidates = [
      ...(await this.discoverLocalPlugins()),
      ...(await this.discoverGlobalPlugins()),
      ...this.cache,
    ];

    // ensure unique by path
    const byPath = new Map<string, CachedPluginEntry>();
    for (const entry of candidates) {
      byPath.set(entry.location, entry);
    }

    for (const entry of byPath.values()) {
      await this.loadAndRegister(entry).catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        log.warn(`Failed to load plugin at ${entry.location}: ${message}`);
      });
    }

    this.detectConflicts();
    await this.persistCache();
    return Array.from(this.loaded.values());
  }

  async reload() {
    this.loaded.clear();
    this.cache = [];
    log.info("Reloading plugins...");
    return this.loadAll(true);
  }

  /**
   * Discover plugins inside workspace (local) scope
   */
  async discoverLocalPlugins(): Promise<CachedPluginEntry[]> {
    const workspaceRoot = this.options.workspaceDir ?? process.cwd();
    const nodeModulesPath = path.join(workspaceRoot, "node_modules");
    const workspacePluginsPath = path.join(PLUGIN_WORKSPACE_ROOT, "node_modules");
    const discovered: CachedPluginEntry[] = [];

    for (const root of [nodeModulesPath, workspacePluginsPath]) {
      if (!(await pathExists(root))) continue;
      discovered.push(...(await this.scanNodeModules(root, "local")));
    }

    return discovered;
  }

  /**
   * Discover globally installed plugins
   */
  async discoverGlobalPlugins(): Promise<CachedPluginEntry[]> {
    const globalNodeModules = path.join(PLUGIN_GLOBAL_ROOT, "node_modules");
    if (!(await pathExists(globalNodeModules))) return [];
    return this.scanNodeModules(globalNodeModules, "global");
  }

  private async scanNodeModules(nodeModulesPath: string, scope: PluginScope): Promise<CachedPluginEntry[]> {
    const entries: CachedPluginEntry[] = [];
    const dirs = await fs.promises.readdir(nodeModulesPath);

    for (const dir of dirs) {
      const full = path.join(nodeModulesPath, dir);
      const statInfo = await fs.promises.stat(full);
      if (!statInfo.isDirectory()) continue;

      if (dir.startsWith("@")) {
        const scoped = await fs.promises.readdir(full);
        for (const child of scoped) {
          const pluginPath = path.join(full, child);
          const entry = await this.tryReadManifest(pluginPath, scope);
          if (entry) entries.push(entry);
        }
      } else {
        const entry = await this.tryReadManifest(full, scope);
        if (entry) entries.push(entry);
      }
    }

    return entries;
  }

  private async tryReadManifest(location: string, scope: PluginScope): Promise<CachedPluginEntry | null> {
    for (const candidate of resolveManifestCandidates(location)) {
      if (await pathExists(candidate)) {
        const pkgPath = path.join(location, "package.json");
        const pkgMtime = await this.tryGetMTime(pkgPath);
        let version: string | undefined;
        try {
          const pkgRaw = await fs.promises.readFile(pkgPath, "utf8");
          const pkg = JSON.parse(pkgRaw);
          version = pkg.version;
        } catch {
          // ignore
        }
        return {
          name: path.basename(location),
          scope,
          location,
          version,
          mtime: pkgMtime,
        };
      }
    }
    return null;
  }

  private async loadAndRegister(entry: CachedPluginEntry) {
    if (this.loaded.has(entry.location)) return;
    const manifest = await loadManifestFromPackage(entry.location);
    validateManifest(manifest, entry.location);

    const context: PluginRuntimeContext = {
      cwd: entry.location,
      manifest,
      sandboxed: Boolean(this.options.sandbox),
      permissions: manifest.permissions ?? [],
      meta: { scope: entry.scope },
    };

    const sandbox = this.options.sandbox ? new PluginSandbox(manifest, context) : null;
    if (sandbox) {
      sandbox.verifyPermissions();
      await sandbox.prepare();
    }

    await executeHooks(manifest.hooks, "onLoad", context, sandbox ?? undefined);
    await this.registerManifest(manifest, context);
    await executeHooks(manifest.hooks, "onRegister", context, sandbox ?? undefined);

    this.loaded.set(entry.location, {
      manifest,
      context,
      scope: entry.scope,
      location: entry.location,
    });
  }

  private async registerManifest(manifest: PluginManifest, context: PluginRuntimeContext) {
    // Commands
    autoRegisterCommands(this.options.cli, manifest, context);
    (manifest.commands ?? []).forEach((cmd) => log.success(`[${manifest.name}] registered command: ${cmd.name}`));

    // Tools
    for (const tool of manifest.tools ?? []) {
      this.options.registerTool?.(tool, context);
      log.success(`[${manifest.name}] registered tool: ${tool.name}`);
    }

    // Apps
    for (const app of manifest.apps ?? []) {
      this.options.registerApp?.(app, context);
      log.success(`[${manifest.name}] registered app: ${app.name}`);
    }

    // Templates
    for (const template of manifest.templates ?? []) {
      this.options.registerTemplate?.(template, context);
      log.success(`[${manifest.name}] registered template: ${template.name}`);
    }

    // Engines
    for (const engine of manifest.engines ?? []) {
      this.options.registerEngine?.(engine, context);
    }

    // Agents
    for (const agent of manifest.agents ?? []) {
      this.options.registerAgent?.(agent, context);
    }

    // SDKs
    for (const sdk of manifest.sdks ?? []) {
      this.options.registerSdk?.(sdk as unknown as PluginSdkSpec, context);
    }
  }

  private detectConflicts() {
    const commandMap = new Map<string, string[]>();
    const toolMap = new Map<string, string[]>();
    const appMap = new Map<string, string[]>();
    const templateMap = new Map<string, string[]>();
    const engineMap = new Map<string, string[]>();
    const agentMap = new Map<string, string[]>();
    const sdkMap = new Map<string, string[]>();

    const push = (map: Map<string, string[]>, key: string, plugin: string) => {
      const list = map.get(key) ?? [];
      list.push(plugin);
      map.set(key, list);
    };

    for (const record of this.loaded.values()) {
      const manifest = record.manifest;
      (manifest.commands ?? []).forEach((cmd) => push(commandMap, cmd.name, manifest.name));
      (manifest.tools ?? []).forEach((tool) => push(toolMap, tool.name, manifest.name));
      (manifest.apps ?? []).forEach((app) => push(appMap, app.name, manifest.name));
      (manifest.templates ?? []).forEach((tpl) => push(templateMap, tpl.name, manifest.name));
      (manifest.engines ?? []).forEach((eng) => push(engineMap, eng.name, manifest.name));
      (manifest.agents ?? []).forEach((ag) => push(agentMap, ag.name, manifest.name));
      (manifest.sdks ?? []).forEach((sdk) => push(sdkMap, sdk.name, manifest.name));
    }

    const report = (label: string, map: Map<string, string[]>) => {
      for (const [name, plugins] of map.entries()) {
        if (plugins.length > 1) {
          log.warn(
            `${chalk.yellow("Conflict")}: ${label} "${name}" provided by ${plugins
              .map((p) => chalk.bold(p))
              .join(", ")}`,
          );
        }
      }
    };

    report("command", commandMap);
    report("tool", toolMap);
    report("app", appMap);
    report("template", templateMap);
    report("engine", engineMap);
    report("agent", agentMap);
    report("sdk", sdkMap);
  }

  private async loadCache(force: boolean) {
    if (force) return;
    const now = Date.now();
    const cache = await readJSON<{ updatedAt?: number; plugins?: CachedPluginEntry[] }>(CACHE_FILE, {});
    if (!cache.updatedAt || !cache.plugins) return;
    if (now - cache.updatedAt > (this.options.cacheTTL ?? DEFAULT_CACHE_TTL)) return;
    this.cache = cache.plugins;
  }

  private async persistCache() {
    const plugins: CachedPluginEntry[] = Array.from(this.loaded.values()).map((record) => ({
      name: record.manifest.name,
      scope: record.scope,
      location: record.location,
      version: record.manifest.version,
    }));
    await ensureDir(path.dirname(CACHE_FILE));
    await writeJSON(CACHE_FILE, { updatedAt: Date.now(), plugins });
  }

  private async tryGetMTime(file: string): Promise<number | undefined> {
    try {
      const st = await stat(file);
      return st.mtimeMs;
    } catch {
      return undefined;
    }
  }
}
