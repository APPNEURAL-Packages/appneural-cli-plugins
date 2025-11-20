import fs from "fs/promises";
import path from "path";
import { execSync } from "child_process";
import { createRequire as createPluginRequire } from "module";
import { getCustomPluginDirectory } from "./plugin-context.js";
import { fileExists, buildPluginCandidate } from "./plugin-utils.js";
import { logger } from "@appneural/cli-shared";
import { getGlobalConfigDir } from "@appneural/cli-shared";
const require = createPluginRequire(import.meta.url);
const PROJECT_PLUGIN_FILE = "appneural.plugins.json";
const GLOBAL_PLUGIN_CONFIG_PATH = path.join(getGlobalConfigDir(), PROJECT_PLUGIN_FILE);
export async function discoverPluginCandidates(context) {
    const candidates = new Map();
    const localModules = path.join(context.rootPath, "node_modules");
    await gatherNodeModulePlugins(localModules, "local", "npm", candidates);
    const globalModules = resolveGlobalModulesPath();
    if (globalModules) {
        await gatherNodeModulePlugins(globalModules, "global", "global", candidates);
    }
    await gatherCustomPlugins(getCustomPluginDirectory(), candidates);
    await gatherProjectPlugins(context, candidates);
    return Array.from(candidates.values());
}
function resolveGlobalModulesPath() {
    try {
        const root = execSync("npm root -g", { encoding: "utf8" }).trim();
        return root || null;
    }
    catch {
        return null;
    }
}
async function gatherNodeModulePlugins(modulesPath, source, type, results) {
    if (!(await fileExists(modulesPath))) {
        return;
    }
    const entries = await safeReadDir(modulesPath);
    await Promise.all(entries.map(async (entry) => {
        if (!entry.isDirectory()) {
            return;
        }
        if (entry.name.startsWith("@")) {
            await scanScopedPackages(path.join(modulesPath, entry.name), entry.name, source, type, results);
            return;
        }
        if (isStandalonePlugin(entry.name)) {
            await registerPluginCandidate(path.join(modulesPath, entry.name), source, type, results);
        }
    }));
}
async function scanScopedPackages(scopePath, scopeName, source, type, results) {
    const scopedEntries = await safeReadDir(scopePath);
    await Promise.all(scopedEntries.map(async (child) => {
        if (!child.isDirectory()) {
            return;
        }
        const packageName = `${scopeName}/${child.name}`;
        if (isScopedPlugin(packageName)) {
            await registerPluginCandidate(path.join(scopePath, child.name), source, type, results);
        }
    }));
}
async function gatherCustomPlugins(directory, results) {
    if (!(await fileExists(directory))) {
        return;
    }
    const nodeModulesDir = path.join(directory, "node_modules");
    if (await fileExists(nodeModulesDir)) {
        await gatherNodeModulePlugins(nodeModulesDir, "custom", "npm", results);
    }
    const entries = await safeReadDir(directory);
    await Promise.all(entries.map(async (entry) => {
        if (!entry.isDirectory() || entry.name === "node_modules") {
            return;
        }
        await registerLocalPlugin(path.join(directory, entry.name), results);
    }));
}
async function gatherProjectPlugins(context, results) {
    await gatherConfiguredPlugins(context, path.join(context.rootPath, PROJECT_PLUGIN_FILE), "project", results);
    await gatherConfiguredPlugins(context, GLOBAL_PLUGIN_CONFIG_PATH, "global", results);
}
async function gatherConfiguredPlugins(context, configPath, source, results) {
    if (!(await fileExists(configPath))) {
        return;
    }
    const customPluginsDir = getCustomPluginDirectory();
    const customNodeModules = path.join(customPluginsDir, "node_modules");
    try {
        const data = JSON.parse(await fs.readFile(configPath, "utf-8"));
        const pluginNames = Array.isArray(data.plugins) ? data.plugins : [];
        await Promise.all(pluginNames.map(async (pluginName) => {
            const resolvedPath = await resolvePackageFromNodeModules(context.rootPath, pluginName);
            if (!resolvedPath) {
                if (await customPluginExists(customNodeModules, pluginName)) {
                    return;
                }
                logger.warn(`APPNEURAL plugin config references missing package: ${pluginName}`);
                return;
            }
            await registerPluginCandidate(resolvedPath, source, "npm", results);
        }));
    }
    catch (error) {
        logger.warn(`APPNEURAL failed to read ${configPath}: ${error instanceof Error ? error.message : error}`);
    }
}
async function registerPluginCandidate(packageRoot, source, pluginType, results) {
    const candidate = await buildPluginCandidate({
        packageRoot,
        source,
        pluginType
    });
    if (!candidate) {
        return;
    }
    if (results.has(candidate.name)) {
        return;
    }
    results.set(candidate.name, candidate);
}
async function registerLocalPlugin(packageRoot, results) {
    const candidate = await buildPluginCandidate({
        packageRoot,
        source: "custom",
        pluginType: "local",
        fallbackName: path.basename(packageRoot),
        fallbackVersion: "0.0.0-local"
    });
    if (!candidate) {
        return;
    }
    if (results.has(candidate.name)) {
        return;
    }
    results.set(candidate.name, candidate);
}
function isStandalonePlugin(name) {
    return name.startsWith("appneural-plugin-");
}
function isScopedPlugin(name) {
    if (!name.startsWith("@appneural/")) {
        return false;
    }
    const suffix = name.replace("@appneural/", "");
    return suffix.startsWith("plugin-") || suffix === "devtools";
}
async function safeReadDir(target) {
    try {
        return await fs.readdir(target, { withFileTypes: true });
    }
    catch {
        return [];
    }
}
async function resolvePackageFromNodeModules(root, packageName) {
    const candidatePaths = [
        path.join(root, "node_modules", packageName),
        path.join(root, "..", "node_modules", packageName)
    ];
    for (const candidate of candidatePaths) {
        if (await fileExists(candidate)) {
            return candidate;
        }
    }
    try {
        const modulePath = require.resolve(packageName, { paths: [root] });
        return path.dirname(modulePath);
    }
    catch {
        return null;
    }
}
async function customPluginExists(nodeModulesRoot, pluginName) {
    if (!nodeModulesRoot) {
        return false;
    }
    const target = resolveCustomPluginPath(nodeModulesRoot, pluginName);
    return fileExists(target);
}
function resolveCustomPluginPath(nodeModulesRoot, pluginName) {
    if (!pluginName) {
        return nodeModulesRoot;
    }
    const segments = pluginName.startsWith("@") ? pluginName.split("/").filter(Boolean) : [pluginName];
    return path.join(nodeModulesRoot, ...segments);
}
//# sourceMappingURL=plugin-finder.js.map