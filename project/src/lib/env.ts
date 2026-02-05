import fs from "node:fs";
import path from "node:path";

function parseEnvValue(rawValue: string): string {
  const value = rawValue.trim();

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function readEnvKeyFromFile(filePath: string, key: string): string | undefined {
  if (!fs.existsSync(filePath)) {
    return undefined;
  }

  const contents = fs.readFileSync(filePath, "utf8");
  const lines = contents.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const envKey = trimmed.slice(0, separatorIndex).trim();
    if (envKey !== key) {
      continue;
    }

    return parseEnvValue(trimmed.slice(separatorIndex + 1));
  }

  return undefined;
}

export function getServerEnv(key: string): string | undefined {
  const existing = process.env[key]?.trim();
  if (existing) {
    return existing;
  }

  const cwd = process.cwd();
  const candidates = Array.from(
    new Set([
      path.resolve(cwd, ".env.local"),
      path.resolve(cwd, ".env"),
      path.resolve(cwd, "project/.env.local"),
      path.resolve(cwd, "project/.env"),
      path.resolve(cwd, "../.env"),
    ]),
  );

  for (const filePath of candidates) {
    const value = readEnvKeyFromFile(filePath, key);
    if (!value) {
      continue;
    }

    process.env[key] = value;
    return value;
  }

  return undefined;
}
