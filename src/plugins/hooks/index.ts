import { PluginHooks, PluginHookName, PluginRuntimeContext } from "../utils/types.js";
import { PluginSandbox } from "../sandbox/index.js";
import { log } from "../utils/logger.js";

export async function executeHooks(
  hooks: PluginHooks | undefined,
  name: PluginHookName,
  context: PluginRuntimeContext,
  sandbox?: PluginSandbox,
) {
  if (!hooks) return;
  const hook = hooks[name];
  if (!hook) return;

  try {
    if (sandbox) {
      await sandbox.run((ctx) => hook(ctx));
    } else {
      await hook(context);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error(`Hook "${name}" failed for ${context.manifest.name}: ${message}`);
    throw error;
  }
}
