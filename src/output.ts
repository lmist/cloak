import chalk from "chalk";

export function formatHeading(text: string): string {
  return chalk.bold.cyan(text);
}

export function formatSuccess(text: string): string {
  return chalk.green(text);
}

export function formatWarning(text: string): string {
  return chalk.yellow(text);
}

export function formatError(text: string): string {
  return chalk.red(text);
}

export function formatInfo(text: string): string {
  return chalk.cyan(text);
}
