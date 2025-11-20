import path from "path";
import fs from "fs/promises";
import chalk from "chalk";
import { execa } from "execa";
export function registerPluginPushCommand(program) {
    program
        .command("plugin push <pluginName>")
        .description("Push plugin to GitHub under APPNEURAL-Packages")
        .action(async (pluginName) => {
        try {
            const DIR_NAME = `appneural-${pluginName}`;
            const pluginPath = path.resolve(DIR_NAME);
            // Validate folder exists
            try {
                await fs.access(pluginPath);
            }
            catch {
                console.error(chalk.red(`❌ Plugin directory '${DIR_NAME}' not found.`));
                return;
            }
            console.log(chalk.cyan(`🚀 Preparing to push ${pluginName} to GitHub...`));
            // Initialize Git if needed
            try {
                await fs.access(path.join(pluginPath, ".git"));
            }
            catch {
                console.log(chalk.yellow("⚠️ No git repo found — initializing..."));
                await execa("git", ["init"], { cwd: pluginPath });
            }
            // Add all files
            await execa("git", ["add", "."], { cwd: pluginPath });
            await execa("git", ["commit", "-m", "Initial commit"], {
                cwd: pluginPath,
            }).catch(() => { });
            // Create GitHub repo
            const repoName = `plugin-${pluginName}`;
            console.log(chalk.cyan(`🌐 Creating GitHub repo: APPNEURAL-Packages/${repoName}`));
            await execa("gh", [
                "repo",
                "create",
                `APPNEURAL-Packages/${repoName}`,
                "--public",
                "--source=.",
                "--remote=origin",
                "--push",
            ], { cwd: pluginPath });
            console.log(chalk.green(`\n🎉 Successfully pushed to GitHub:`));
            console.log(chalk.cyan(`https://github.com/APPNEURAL-Packages/${repoName}\n`));
        }
        catch (err) {
            console.error(chalk.red(`❌ Failed to push plugin: ${err instanceof Error ? err.message : err}`));
        }
    });
}
//# sourceMappingURL=plugin-push.js.map