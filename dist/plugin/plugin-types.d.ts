import type { Command } from "commander";
export interface PluginManifest {
    name: string;
    version: string;
    description?: string;
}
export interface PluginLogger {
    debug(message: string): void;
    info(message: string): void;
    warn(message: string): void;
    error(message: string): void;
    success(message: string): void;
}
export interface PluginContext {
    cli: Command;
    logger: PluginLogger;
    rootPath: string;
    pluginPath: string;
    pluginName: string;
    version: string;
    pluginType: PluginRuntimeType;
}
export interface AppneuralPluginDefinition {
    name: string;
    version: string;
    install(cli: Command, context: PluginContext): void | Promise<void>;
}
export interface PluginModuleShape {
    default?: AppneuralPluginDefinition;
}
export type PluginSource = "local" | "global" | "custom" | "project";
export type PluginRuntimeType = "local" | "npm" | "global";
export interface PluginCandidate {
    name: string;
    version?: string;
    description?: string;
    packageRoot: string;
    entryFile: string;
    source: PluginSource;
    pluginType: PluginRuntimeType;
}
export interface PluginStatus {
    candidate: PluginCandidate;
    loaded: boolean;
    error?: string;
    installedAt?: string;
    durationMs?: number;
}
//# sourceMappingURL=plugin-types.d.ts.map