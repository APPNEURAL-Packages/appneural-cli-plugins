import type { PluginManifest, PluginModuleShape, AppneuralPluginDefinition, PluginCandidate, PluginSource, PluginRuntimeType } from "./plugin-types.js";
export declare function fileExists(target: string): Promise<boolean>;
export declare function readPackageManifest(packageRoot: string): Promise<PluginManifest | null>;
export declare function resolveEntryFile(packageRoot: string, pkg?: Record<string, unknown>): Promise<string | null>;
export declare function importPluginModule(entryFile: string): Promise<PluginModuleShape | null>;
export declare function isValidPluginDefinition(subject: unknown): subject is AppneuralPluginDefinition;
export interface BuildCandidateOptions {
    packageRoot: string;
    source: PluginSource;
    pluginType: PluginRuntimeType;
    fallbackName?: string;
    fallbackVersion?: string;
}
export declare function buildPluginCandidate(options: BuildCandidateOptions): Promise<PluginCandidate | null>;
export declare function loadRawPackage(packageRoot: string): Promise<Record<string, unknown> | null>;
export declare function getPluginPriority(type: PluginRuntimeType): number;
//# sourceMappingURL=plugin-utils.d.ts.map