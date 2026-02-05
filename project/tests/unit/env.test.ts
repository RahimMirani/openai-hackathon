import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { getServerEnv } from "../../src/lib/env";

function withTempDir(run: (tempDir: string) => void): void {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "env-test-"));
  const originalCwd = process.cwd();

  try {
    process.chdir(tempDir);
    run(tempDir);
  } finally {
    process.chdir(originalCwd);
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

test("getServerEnv prefers non-empty process.env values", () => {
  const key = "UNIT_ENV_FROM_PROCESS";
  const previous = process.env[key];

  withTempDir(() => {
    process.env[key] = "  from-process  ";
    assert.equal(getServerEnv(key), "from-process");
  });

  if (previous === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = previous;
  }
});

test("getServerEnv reads quoted values from .env.local", () => {
  const key = "UNIT_ENV_FROM_LOCAL_FILE";
  const previous = process.env[key];

  withTempDir((tempDir) => {
    delete process.env[key];
    fs.writeFileSync(
      path.join(tempDir, ".env.local"),
      `# comment\n${key}="from-file"\n`,
    );

    assert.equal(getServerEnv(key), "from-file");
    assert.equal(process.env[key], "from-file");
  });

  if (previous === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = previous;
  }
});

test("getServerEnv falls back to project/.env when root env files are absent", () => {
  const key = "UNIT_ENV_FROM_PROJECT_FILE";
  const previous = process.env[key];

  withTempDir((tempDir) => {
    delete process.env[key];
    const projectDir = path.join(tempDir, "project");
    fs.mkdirSync(projectDir, { recursive: true });
    fs.writeFileSync(path.join(projectDir, ".env"), `${key}=from-project\n`);

    assert.equal(getServerEnv(key), "from-project");
  });

  if (previous === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = previous;
  }
});

test("getServerEnv returns undefined when a key is missing", () => {
  const key = "UNIT_ENV_DOES_NOT_EXIST";
  const previous = process.env[key];

  withTempDir(() => {
    delete process.env[key];
    assert.equal(getServerEnv(key), undefined);
  });

  if (previous === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = previous;
  }
});
