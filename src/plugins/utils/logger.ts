import chalk from "chalk";

export const log = {
  info: (message: string) => console.log(chalk.cyan("[anx] "), message),
  warn: (message: string) => console.warn(chalk.yellow("[anx] "), message),
  error: (message: string) => console.error(chalk.red("[anx] "), message),
  success: (message: string) => console.log(chalk.green("[anx] "), message),
  verbose: (message: string) => console.debug(chalk.gray("[anx] "), message),
};

export function formatList(items: string[], emptyLabel = "None"): string {
  return items.length ? items.join(chalk.gray(", ")) : chalk.gray(emptyLabel);
}
