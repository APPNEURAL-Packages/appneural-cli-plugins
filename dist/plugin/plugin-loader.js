import chalk from "chalk";
import { logger } from "@appneural/cli-shared";
import { discoverPluginCandidates } from "./plugin-finder.js";
import { createBaseContext, createPluginContext } from "./plugin-context.js";
import { importPluginModule, isValidPluginDefinition, fileExists, getPluginPriority } from "./plugin-utils.js";
const loadedPluginNames = new Set();
let lastLoadedPlugins = [];
const pluginStatuses = new Map();
const pluginCommandRegistry = new Map();
export function getLoadedPlugins() {
    return [...lastLoadedPlugins];
}
export function getPluginStatuses() {
    return Array.from(pluginStatuses.values());
}
export async function reloadPlugins(program, options) {
    loadedPluginNames.clear();
    pluginStatuses.clear();
    await loadPlugins(program, options);
}
function dedupeCandidates(candidates) {
    const deduped = new Map();
    for (const candidate of candidates) {
        const existing = deduped.get(candidate.name);
        if (!existing || getPluginPriority(candidate.pluginType) > getPluginPriority(existing.pluginType)) {
            if (existing) {
                logger.warn(`${chalk.yellow("⚠")} Duplicate plugin '${candidate.name}' detected. Preferring ${candidate.pluginType} over ${existing.pluginType}.`);
            }
            deduped.set(candidate.name, candidate);
        }
    }
    return Array.from(deduped.values());
}
export async function loadPlugins(program, options = {}) {
    clearPluginCommands();
    const baseContext = createBaseContext(program);
    const discovered = await discoverPluginCandidates(baseContext);
    const candidates = dedupeCandidates(discovered);
    lastLoadedPlugins = candidates;
    pluginStatuses.clear();
    const logPluginLifecycle = options.logPluginLifecycle ?? false;
    if (candidates.length === 0) {
        logger.info(`${chalk.cyan("ℹ")} No APPNEURAL plugins discovered`);
        return;
    }
    for (const candidate of candidates) {
        if (loadedPluginNames.has(candidate.name)) {
            continue;
        }
        const status = {
            candidate,
            loaded: false
        };
        pluginStatuses.set(candidate.name, status);
        if (!(await fileExists(candidate.entryFile))) {
            status.error = `Entry file missing: ${candidate.entryFile}`;
            reportFailure(candidate.name, status.error);
            continue;
        }
        const start = Date.now();
        const moduleShape = await importPluginModule(candidate.entryFile);
        if (!moduleShape) {
            status.error = "Failed to import module";
            reportFailure(candidate.name, status.error);
            continue;
        }
        const plugin = moduleShape.default;
        if (!isValidPluginDefinition(plugin)) {
            status.error = "Invalid plugin export";
            reportFailure(candidate.name, status.error);
            continue;
        }
        const pluginCli = createPluginCliProxy(baseContext.cli, candidate.name);
        const pluginEnvironment = { ...baseContext, cli: pluginCli };
        const pluginContext = createPluginContext(pluginEnvironment, candidate);
        try {
            await plugin.install(pluginCli, pluginContext);
            loadedPluginNames.add(plugin.name);
            status.loaded = true;
            status.error = undefined;
            status.installedAt = new Date().toISOString();
            status.durationMs = Date.now() - start;
            if (logPluginLifecycle) {
                logger.info(`${chalk.green("✔")} Loaded plugin: ${pluginContext.pluginName} (${pluginContext.pluginType}) in ${status.durationMs}ms`);
                // logger.info(`${chalk.cyan("ℹ")} Source: ${candidate.source} | Path: ${candidate.packageRoot}`);
            }
        }
        catch (error) {
            status.error = error instanceof Error ? error.message : String(error);
            reportFailure(pluginContext.pluginName, status.error);
        }
    }
}
function reportFailure(name, reason) {
    logger.warn(`${chalk.red("✖")} Plugin failed: ${name} – Reason: ${reason}`);
}
function createPluginCliProxy(cli, pluginName) {
    return createCommandProxy(cli, pluginName);
}
function registerPluginCommand(parent, nameAndArgs, opts, pluginName) {
    const trimmed = nameAndArgs.trim();
    if (!trimmed) {
        const fallback = parent.command(trimmed, opts);
        return createCommandProxy(fallback, pluginName);
    }
    const { commandTokens, argsPart } = splitCommandAndArgs(trimmed);
    if (commandTokens.length === 0) {
        const fallback = parent.command(trimmed, opts);
        return createCommandProxy(fallback, pluginName);
    }
    let current = parent;
    for (let i = 0; i < commandTokens.length - 1; i++) {
        current = findOrCreateChildCommand(current, commandTokens[i], pluginName);
    }
    const finalToken = commandTokens[commandTokens.length - 1];
    const finalDefinition = argsPart ? `${finalToken} ${argsPart}` : finalToken;
    const { command: finalCommand, wasCreated } = findOrCreateCommand(current, finalToken, finalDefinition, opts, pluginName);
    if (wasCreated) {
        trackPluginCommand(pluginName, finalCommand);
    }
    return createCommandProxy(finalCommand, pluginName);
}
function findOrCreateChildCommand(parent, name, pluginName) {
    const existing = parent.commands.find((child) => child.name() === name || child.aliases().includes(name));
    if (existing) {
        return existing;
    }
    const child = parent.command(name);
    trackPluginCommand(pluginName, child);
    return child;
}
function findOrCreateCommand(parent, name, definition, opts, pluginName) {
    const existing = parent.commands.find((child) => child.name() === name || child.aliases().includes(name));
    if (existing) {
        return { command: existing, wasCreated: false };
    }
    try {
        return { command: parent.command(definition, opts), wasCreated: true };
    }
    catch (error) {
        if (isDuplicateCommandError(error, name)) {
            const conflicting = parent.commands.find((child) => child.name() === name || child.aliases().includes(name));
            if (conflicting) {
                return { command: conflicting, wasCreated: false };
            }
        }
        throw error;
    }
}
function splitCommandAndArgs(nameAndArgs) {
    const parts = nameAndArgs.trim().split(/\s+/);
    const commandTokens = [];
    let argsStartIndex = parts.length;
    for (let i = 0; i < parts.length; i += 1) {
        const token = parts[i];
        if (token.startsWith("<") || token.startsWith("[") || token.startsWith("-")) {
            argsStartIndex = i;
            break;
        }
        commandTokens.push(token);
    }
    const argsPart = argsStartIndex < parts.length ? parts.slice(argsStartIndex).join(" ") : "";
    return { commandTokens, argsPart };
}
function clearPluginCommands() {
    if (pluginCommandRegistry.size === 0) {
        return;
    }
    for (const commands of pluginCommandRegistry.values()) {
        for (const command of commands) {
            detachCommand(command);
        }
    }
    pluginCommandRegistry.clear();
}
function detachCommand(command) {
    const parent = command.parent;
    if (!parent) {
        return;
    }
    const parentCommands = parent.commands;
    const index = parentCommands.indexOf(command);
    if (index >= 0) {
        parentCommands.splice(index, 1);
    }
}
function trackPluginCommand(pluginName, command) {
    let commands = pluginCommandRegistry.get(pluginName);
    if (!commands) {
        commands = new Set();
        pluginCommandRegistry.set(pluginName, commands);
    }
    commands.add(command);
}
function isDuplicateCommandError(error, name) {
    return (error instanceof Error &&
        error.message.includes(`cannot add command '${name}'`));
}
function createCommandProxy(target, pluginName) {
    return new Proxy(target, {
        get(commandTarget, prop, receiver) {
            if (prop === "command") {
                return function command(nameAndArgs, opts) {
                    if (typeof nameAndArgs !== "string") {
                        const child = commandTarget.command(nameAndArgs, opts);
                        return createCommandProxy(child, pluginName);
                    }
                    return registerPluginCommand(commandTarget, nameAndArgs, opts, pluginName);
                };
            }
            return Reflect.get(commandTarget, prop, receiver);
        }
    });
}
//# sourceMappingURL=plugin-loader.js.map