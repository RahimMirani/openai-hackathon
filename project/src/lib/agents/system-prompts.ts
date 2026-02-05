import fs from "node:fs";
import path from "node:path";

export type AgentPromptKey = "design" | "build" | "visualize" | "fix" | "playtest";

const PROMPT_FILES: Record<AgentPromptKey, string> = {
  design: "src/agents/design/system-prompt.md",
  build: "src/agents/engineering/system-prompt.md",
  visualize: "src/agents/visualization/system-prompt.md",
  fix: "src/agents/iteration/system-prompt.md",
  playtest: "src/agents/playtesting/system-prompt.md",
};

const cache = new Map<AgentPromptKey, string>();

export function getAgentSystemPrompt(key: AgentPromptKey, fallback: string): string {
  const cached = cache.get(key);
  if (cached) {
    return cached;
  }

  const promptFile = PROMPT_FILES[key];
  const fullPath = path.resolve(process.cwd(), promptFile);

  if (!fs.existsSync(fullPath)) {
    cache.set(key, fallback);
    return fallback;
  }

  const content = fs.readFileSync(fullPath, "utf8").trim();
  const resolved = content || fallback;
  cache.set(key, resolved);
  return resolved;
}
