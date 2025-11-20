import path from "path";
import type { Command } from "commander";
import { logger as coreLogger } from "@appneural/cli-shared";
import pkg from "../../package.json" with { type: "json" };
import type { PluginCandidate, PluginContext } from "./plugin-types.js";
import { getGlobalConfigDir } from "@appneural/cli-shared";

export interface PluginEnvironment {
  cli: Command;
  rootPath: string;
  logger: typeof coreLogger;
  cliVersion: string;
}

export function createBaseContext(program: Command): PluginEnvironment {
  return {
    cli: program,
    rootPath: process.cwd(),
    logger: coreLogger,
    cliVersion: typeof pkg.version === "string" ? pkg.version : "0.0.0"
  };
}

export function createPluginContext(base: PluginEnvironment, candidate: PluginCandidate): PluginContext {
  return {
    cli: base.cli,
    logger: base.logger,
    rootPath: base.rootPath,
    pluginPath: candidate.packageRoot,
    pluginName: candidate.name,
    version: candidate.version ?? "0.0.0",
    pluginType: candidate.pluginType
  } as PluginContext;
}

export function getCustomPluginDirectory(): string {
  return path.join(getGlobalConfigDir(), "plugins");
}
