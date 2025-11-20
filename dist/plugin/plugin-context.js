import path from "path";
import { logger as coreLogger } from "@appneural/cli-shared";
import pkg from "../../package.json" with { type: "json" };
import { getGlobalConfigDir } from "@appneural/cli-shared";
export function createBaseContext(program) {
    return {
        cli: program,
        rootPath: process.cwd(),
        logger: coreLogger,
        cliVersion: typeof pkg.version === "string" ? pkg.version : "0.0.0"
    };
}
export function createPluginContext(base, candidate) {
    return {
        cli: base.cli,
        logger: base.logger,
        rootPath: base.rootPath,
        pluginPath: candidate.packageRoot,
        pluginName: candidate.name,
        version: candidate.version ?? "0.0.0",
        pluginType: candidate.pluginType
    };
}
export function getCustomPluginDirectory() {
    return path.join(getGlobalConfigDir(), "plugins");
}
//# sourceMappingURL=plugin-context.js.map