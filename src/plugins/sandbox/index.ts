import { log } from "../utils/logger.js";
import { PluginManifest, PluginPermission, PluginRuntimeContext } from "../utils/types.js";

export class PluginSandbox {
  constructor(private manifest: PluginManifest, private context: PluginRuntimeContext) {}

  async prepare() {
    // Placeholder for isolation setup (e.g., vm, worker, or process boundary)
    log.verbose(`Preparing sandbox for ${this.manifest.name}`);
  }

  verifyPermissions() {
    const permissions = this.manifest.permissions ?? [];
    if (permissions.includes("sandbox:escape")) {
      log.warn(`Plugin ${this.manifest.name} requests sandbox escape. Review carefully.`);
    }
  }

  async run<T>(fn: (context: PluginRuntimeContext) => T | Promise<T>): Promise<T> {
    const isolatedContext = this.createIsolatedContext();
    try {
      return await fn(isolatedContext);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log.error(`Sandboxed plugin error (${this.manifest.name}): ${message}`);
      throw error;
    }
  }

  private createIsolatedContext(): PluginRuntimeContext {
    const clone: PluginRuntimeContext = {
      ...this.context,
      meta: { ...(this.context.meta ?? {}) },
      permissions: [...(this.context.permissions ?? [])],
    };
    return Object.freeze(clone);
  }
}

export function hasPermission(manifest: PluginManifest, permission: PluginPermission) {
  return (manifest.permissions ?? []).includes(permission);
}
