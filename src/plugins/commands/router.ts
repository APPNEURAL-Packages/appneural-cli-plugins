import { Command } from "commander";
import { executeHooks } from "../hooks/index.js";
import { log } from "../utils/logger.js";
import { PluginManifest, PluginCommandSpec, PluginRuntimeContext } from "../utils/types.js";

export function autoRegisterCommands(cli: Command, manifest: PluginManifest, context: PluginRuntimeContext) {
  const commands = manifest.commands ?? [];
  for (const commandSpec of commands) {
    registerPluginCommand(cli, manifest, commandSpec, context);
  }
}

export function registerPluginCommand(
  cli: Command,
  manifest: PluginManifest,
  spec: PluginCommandSpec,
  context: PluginRuntimeContext,
) {
  const command = cli.command(spec.name);
  if (spec.alias) {
    command.alias(spec.alias);
  }
  if (spec.description) {
    command.description(spec.description);
  }
  for (const option of spec.options ?? []) {
    if (option.defaultValue !== undefined) {
      command.option(option.flags, option.description, option.defaultValue as never);
    } else {
      command.option(option.flags, option.description);
    }
  }

  command.action(async (...args: unknown[]) => {
    const commandArgs = args.slice(0, -1) as string[];
    const commandContext: PluginRuntimeContext = {
      ...context,
      meta: { ...(context.meta ?? {}), commandName: spec.name },
    };
    try {
      await executeHooks(manifest.hooks, "onRun", commandContext);
      await executeHooks(manifest.hooks, "onCommandRun", commandContext);
      if (spec.action) {
        await spec.action(commandArgs, commandContext);
      } else {
        log.warn(`Command "${spec.name}" from ${manifest.name} has no handler.`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log.error(`Command "${spec.name}" failed: ${message}`);
      process.exitCode = 1;
    }
  });
}
