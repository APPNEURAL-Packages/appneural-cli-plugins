import * as path from 'path';
import { promises as fs } from 'fs';
import chalk from 'chalk';
import { execa } from 'execa';
export function registerPluginPublishCommand(program) {
    program
        .command("plugin publish <pluginName>")
        .description("Publish plugin to npm registry")
        .action(async (pluginName) => {
        try {
            const DIR_NAME = `appneural-${pluginName}`;
            const pluginPath = path.resolve(DIR_NAME);
            const pkgPath = path.join(pluginPath, "package.json");
            // Validate folder + package.json
            try {
                await fs.access(pkgPath);
            }
            catch {
                console.error(chalk.red(`❌ package.json not found in ${DIR_NAME}`));
                return;
            }
            console.log(chalk.cyan(`🚀 Publishing @appneural/${pluginName} to npm...`));
            // Load package.json
            const pkgRaw = await fs.readFile(pkgPath, "utf-8");
            const pkg = JSON.parse(pkgRaw);
            // Bump patch version
            const [major, minor, patch] = pkg.version.split(".");
            const newVersion = `${major}.${minor}.${Number(patch) + 1}`;
            pkg.version = newVersion;
            // Write updated version
            await fs.writeFile(pkgPath, JSON.stringify(pkg, null, 2));
            console.log(chalk.yellow(`📦 Updated version → ${newVersion}`));
            console.log(chalk.cyan(`🛠️ Building plugin...`));
            // Build plugin
            await execa("npm", ["run", "build"], { cwd: pluginPath });
            console.log(chalk.cyan(`🚀 Publishing to npm...`));
            // Publish plugin
            await execa("npm", ["publish", "--access", "public"], { cwd: pluginPath });
            console.log(chalk.green(`\n🎉 Successfully published @appneural/${pluginName}@${newVersion}\n`));
        }
        catch (err) {
            console.error(chalk.red(`❌ Failed to publish plugin: ${err instanceof Error ? err.message : err}`));
        }
    });
}
//# sourceMappingURL=plugin-publish.js.map