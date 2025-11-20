import fs from "fs";
import path from "path";
import { mkdir } from "fs/promises";
import { logger } from "@appneural/cli-shared";
import { reloadPlugins } from "./plugin-loader.js";
import { getCustomPluginDirectory } from "./plugin-context.js";
const LOCAL_PLUGINS_DIR = getCustomPluginDirectory();
const DEBOUNCE_MS = 500;
export async function watchLocalPlugins(program) {
    await mkdir(LOCAL_PLUGINS_DIR, { recursive: true });
    logger.info(`Watching ${LOCAL_PLUGINS_DIR} for plugin changes (Ctrl+C to stop)`);
    const pending = new Set();
    let timer = null;
    let stopped = false;
    const scheduleReload = () => {
        if (timer) {
            clearTimeout(timer);
        }
        timer = setTimeout(async () => {
            timer = null;
            if (pending.size === 0 || stopped) {
                return;
            }
            const affected = Array.from(pending.values());
            pending.clear();
            logger.info(`Detected changes in local plugins: ${affected.join(", ")}`);
            try {
                await reloadPlugins(program);
                logger.success(`Reloaded local plugins (${affected.join(", ")})`);
            }
            catch (error) {
                logger.error(`Failed to reload plugins: ${error instanceof Error ? error.message : String(error)}`);
            }
        }, DEBOUNCE_MS);
    };
    const watcher = fs.watch(LOCAL_PLUGINS_DIR, {
        recursive: true
    }, (_eventType, filename) => {
        if (!filename || stopped) {
            return;
        }
        const relative = filename.toString();
        const folder = relative.split(path.sep)[0] || relative;
        if (!folder) {
            return;
        }
        pending.add(folder);
        scheduleReload();
    });
    await new Promise((resolve) => {
        const stop = () => {
            if (stopped) {
                return;
            }
            stopped = true;
            if (timer) {
                clearTimeout(timer);
            }
            watcher.close();
            process.off("SIGINT", stop);
            process.off("SIGTERM", stop);
            resolve();
        };
        process.on("SIGINT", stop);
        process.on("SIGTERM", stop);
    });
}
//# sourceMappingURL=plugin-watcher.js.map