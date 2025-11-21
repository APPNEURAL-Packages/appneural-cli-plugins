import path from "node:path";
import { execa } from "execa";
import { ensureDir, pathExists, readJSON, removePath, writeJSON } from "../utils/fs.js";
import { log } from "../utils/logger.js";
import { PLUGIN_GLOBAL_ROOT, PLUGIN_WORKSPACE_ROOT, REGISTRY_FILE, resolvePluginInstallPath } from "../utils/paths.js";
import { ManifestValidationError, PluginError, PluginNotFoundError } from "../utils/errors.js";
import { PluginManifest, RegistryRecord } from "../utils/types.js";
import { validateManifest } from "../manifest/validator.js";
import { loadManifestFromModule } from "../manifest/index.js";
import { executeHooks } from "../hooks/index.js";

interface RegistryData {
  plugins: RegistryRecord[];
}

export class PluginRegistry {
  private data: RegistryData = { plugins: [] };

  async load() {
    this.data = await readJSON(REGISTRY_FILE, { plugins: [] });
  }

  async save() {
    await ensureDir(path.dirname(REGISTRY_FILE));
    await writeJSON(REGISTRY_FILE, this.data);
  }

  list(): RegistryRecord[] {
    return this.data.plugins;
  }

  find(name: string): RegistryRecord | undefined {
    return this.data.plugins.find((p) => p.name === name);
  }

  search(keyword: string): RegistryRecord[] {
    const lower = keyword.toLowerCase();
    return this.data.plugins.filter((p) => p.name.toLowerCase().includes(lower));
  }

  async add(record: RegistryRecord) {
    const existing = this.find(record.name);
    if (existing) {
      Object.assign(existing, record);
    } else {
      this.data.plugins.push(record);
    }
    await this.save();
  }

  async remove(name: string) {
    this.data.plugins = this.data.plugins.filter((p) => p.name !== name);
    await this.save();
  }

  async enable(name: string) {
    const record = this.findOrThrow(name);
    record.enabled = true;
    await this.save();
  }

  async disable(name: string) {
    const record = this.findOrThrow(name);
    record.enabled = false;
    await this.save();
  }

  async install(name: string, scope: "global" | "workspace" = "global") {
    log.info(`Installing ${name} (${scope})`);
    const prefixRoot = scope === "global" ? PLUGIN_GLOBAL_ROOT : PLUGIN_WORKSPACE_ROOT;
    await ensureDir(prefixRoot);
    await execa("npm", ["install", `${name}@latest`, "--prefix", prefixRoot], {
      stdio: "inherit",
    });

    const manifest = await this.readManifest(name, scope);
    await this.add({
      name,
      version: manifest.version,
      location: resolvePluginInstallPath(name, scope),
      enabled: true,
      source: scope === "global" ? "global" : "workspace",
      manifest,
      lastChecked: Date.now(),
    });
  }

  async uninstall(name: string, scope: "global" | "workspace" = "global") {
    log.info(`Uninstalling ${name} (${scope})`);
    const installPath = resolvePluginInstallPath(name, scope);
    await removePath(installPath);
    await this.remove(name);
  }

  async update(name: string, scope: "global" | "workspace" = "global") {
    const record = this.findOrThrow(name);
    log.info(`Updating ${name}`);
    const prefixRoot = scope === "global" ? PLUGIN_GLOBAL_ROOT : PLUGIN_WORKSPACE_ROOT;
    await ensureDir(prefixRoot);
    await execa("npm", ["install", `${name}@latest`, "--prefix", prefixRoot], {
      stdio: "inherit",
    });
    const manifest = await this.readManifest(name, scope);
    record.version = manifest.version;
    record.manifest = manifest;
    record.lastChecked = Date.now();
    await this.save();
  }

  async link(name: string, targetPath: string) {
    const manifest = await this.readManifestFromPath(targetPath);
    await this.add({
      name: manifest.name ?? name,
      version: manifest.version,
      location: targetPath,
      enabled: true,
      source: "linked",
      manifest,
      linked: true,
    });
  }

  async unlink(name: string) {
    const record = this.findOrThrow(name);
    if (record.source !== "linked") {
      throw new PluginError(`Plugin ${name} is not linked.`);
    }
    await this.remove(name);
  }

  async readManifest(name: string, scope: "global" | "workspace" = "global"): Promise<PluginManifest> {
    const entry = path.join(resolvePluginInstallPath(name, scope));
    if (!(await pathExists(entry))) {
      throw new PluginNotFoundError(name);
    }
    return this.readManifestFromPath(entry);
  }

  async readManifestFromPath(pluginPath: string): Promise<PluginManifest> {
    const manifest = await loadManifestFromModule(path.join(pluginPath, "dist", "index.js")).catch(async () => {
      const fallback = await loadManifestFromModule(path.join(pluginPath, "index.js"));
      return fallback;
    });
    return validateManifest(manifest, pluginPath);
  }

  async runHook(name: string, hook: keyof NonNullable<PluginManifest["hooks"]>) {
    const record = this.findOrThrow(name);
    const hooks = record.manifest.hooks;
    if (!hooks || !hooks[hook]) return;
    await executeHooks(hooks, hook, {
      cwd: record.location,
      manifest: record.manifest,
      sandboxed: false,
      permissions: record.manifest.permissions ?? [],
    });
  }

  private findOrThrow(name: string): RegistryRecord {
    const record = this.find(name);
    if (!record) {
      throw new PluginNotFoundError(name);
    }
    return record;
  }
}
