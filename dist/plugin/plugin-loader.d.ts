import type { Command } from "commander";
import type { PluginCandidate, PluginStatus } from "./plugin-types.js";
export declare function getLoadedPlugins(): PluginCandidate[];
export declare function getPluginStatuses(): PluginStatus[];
export interface ReloadPluginsOptions {
    logPluginLifecycle?: boolean;
}
export declare function reloadPlugins(program: Command, options?: ReloadPluginsOptions): Promise<void>;
export declare function loadPlugins(program: Command, options?: ReloadPluginsOptions): Promise<void>;
//# sourceMappingURL=plugin-loader.d.ts.map