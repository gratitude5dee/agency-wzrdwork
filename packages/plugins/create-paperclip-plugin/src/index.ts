#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import process from "node:process";

import { createScaffoldTemplate } from "./template.js";

type TemplateFiles = ReturnType<typeof createScaffoldTemplate>;

function parseArgs(argv: string[]) {
  const args = [...argv];
  const command = args.shift() ?? "help";
  const values = new Map<string, string>();
  const positionals: string[] = [];

  while (args.length > 0) {
    const current = args.shift()!;
    if (current.startsWith("--")) {
      const [flag, inlineValue] = current.split("=", 2);
      if (inlineValue !== undefined) {
        values.set(flag, inlineValue);
        continue;
      }

      const next = args[0];
      if (next && !next.startsWith("--")) {
        values.set(flag, args.shift()!);
      } else {
        values.set(flag, "true");
      }
      continue;
    }

    positionals.push(current);
  }

  return {
    command,
    positionals,
    values,
  };
}

async function writeTemplate(
  targetDir: string,
  template: TemplateFiles,
) {
  await mkdir(targetDir, { recursive: true });

  for (const file of template) {
    const filePath = join(targetDir, file.path);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, file.content, "utf8");
  }
}

function printHelp() {
  process.stdout.write(
    [
      "create-paperclip-plugin",
      "",
      "Usage:",
      "  create-paperclip-plugin scaffold <plugin-name> [target-dir]",
      "",
      "Options:",
      "  --package <name>      Override the generated package name",
      "  --description <text>   Override the generated description",
      "",
    ].join("\n"),
  );
}

async function main() {
  const { command, positionals, values } = parseArgs(process.argv.slice(2));

  if (command === "help" || command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  if (command !== "scaffold") {
    printHelp();
    process.exitCode = 1;
    return;
  }

  const pluginName = positionals[0];
  if (!pluginName) {
    process.stderr.write("Missing plugin name.\n");
    process.exitCode = 1;
    return;
  }

  const targetDir = resolve(positionals[1] ?? pluginName);
  const description = values.get("--description") ?? `Paperclip-style plugin scaffold for ${pluginName}.`;
  const packageName = values.get("--package") ?? pluginName;
  const template = createScaffoldTemplate({
    pluginName,
    packageName,
    description,
  });

  await writeTemplate(targetDir, template);

  process.stdout.write(`Scaffold written to ${targetDir}\n`);
}

void main().catch((error) => {
  process.stderr.write(error instanceof Error ? `${error.stack ?? error.message}\n` : `${String(error)}\n`);
  process.exitCode = 1;
});
