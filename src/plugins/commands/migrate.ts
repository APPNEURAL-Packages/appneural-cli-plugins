import { log } from "../utils/logger.js";

export async function handleMigrate(pluginName: string) {
  log.info(`Running migrations for ${pluginName} (stub).`);
}

export async function handleMigrateList() {
  log.info("No migrations recorded (stub).");
}

export async function handleMigrateRun(file: string) {
  log.info(`Running migration ${file} (stub).`);
}
