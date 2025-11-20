import type { Command } from "commander";
import { logger as coreLogger } from "@appneural/cli-shared";
import type { PluginCandidate, PluginContext } from "./plugin-types.js";
export interface PluginEnvironment {
    cli: Command;
    rootPath: string;
    logger: typeof coreLogger;
    cliVersion: string;
}
export declare function createBaseContext(program: Command): PluginEnvironment;
export declare function createPluginContext(base: PluginEnvironment, candidate: PluginCandidate): PluginContext;
export declare function getCustomPluginDirectory(): string;
//# sourceMappingURL=plugin-context.d.ts.map