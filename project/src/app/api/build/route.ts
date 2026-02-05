import { runLlmBackend } from "@/lib/llm/backend";
import { getAgentSystemPrompt } from "@/lib/agents/system-prompts";
import {
  deriveFallbackConfig,
  detectDemoMode,
  mergeGameConfig,
  type DesignPlan,
  type GameConfig,
} from "@/lib/workflow/game-config";
import { type ConceptNode } from "@/lib/workflow/concepts";
import {
  llmConceptExcerpt,
  resolveWorkflowInput,
  type WorkflowInputShape,
} from "@/lib/workflow/input";
import { parseJsonObjectFromText } from "@/lib/workflow/json";
import { applyIssueFixes, evaluateGameConfig } from "@/lib/workflow/playtest";

const BUILD_MODEL = "gpt-4.1-mini";
const BUILD_SYSTEM_PROMPT = getAgentSystemPrompt(
  "build",
  "You are the Engineering Agent. Return stable, valid JSON configs.",
);

type BuildRequestBody = WorkflowInputShape & {
  plan?: Partial<DesignPlan>;
  conceptNode?: Partial<ConceptNode> | null;
};

type BuildConfigCandidate = Partial<GameConfig> & {
  config?: Partial<GameConfig>;
};

function buildConfigPrompt(
  concept: string,
  sourceLabel: string,
  plan: Partial<DesignPlan> | undefined,
  conceptNode: Partial<ConceptNode> | null | undefined,
): string {
  const suggestedMode = conceptNode?.suggestedMode
    ? detectDemoMode(String(conceptNode.suggestedMode))
    : detectDemoMode(concept);

  return [
    "You are the Game Engineering Agent.",
    "Generate a playable physics-concept demo config from the concept.",
    "The canvas must demonstrate the concept directly, not a generic dodge game.",
    "The output must be grounded in the provided source input.",
    "Return JSON only.",
    "Expected shape:",
    "{",
    '  "title": string,',
    '  "concept": string,',
    '  "goal": string,',
    '  "player": { "speed": number, "radius": number, "color": "#RRGGBB" },',
    '  "obstacles": { "count": number, "speed": number, "radius": number, "color": "#RRGGBB", "spread": number },',
    '  "arena": { "width": number, "height": number, "background": "#RRGGBB", "gridColor": "#RRGGBB" },',
    '  "rules": { "lives": number, "timer": number },',
    '  "visualization": { "showGrid": boolean, "showTrails": boolean, "showVelocityHints": boolean, "accent": "#RRGGBB" }',
    '  "demonstration": { "mode": "gravity"|"collision"|"projectile", "summary": string, "gravity": number, "baseRestitution": number, "spawnHeight": number },',
    '  "learning": {',
    '    "sidebarTitle": string,',
    '    "coachPrompt": string,',
    '    "tutorTips": string[],',
    '    "checkpoints": string[],',
    '    "equationAnnotations": [',
    '      { "id": string, "label": string, "equation": string, "explanation": string, "variables": string[] }',
    "    ]",
    "  }",
    "}",
    `Suggested mode for this concept: ${suggestedMode}`,
    `Concept node: ${JSON.stringify(conceptNode ?? {})}`,
    `Source: ${sourceLabel}`,
    `Concept input: ${llmConceptExcerpt(concept)}`,
    `Design plan: ${JSON.stringify(plan ?? {})}`,
  ].join("\n");
}

function pickConfigCandidate(candidate: BuildConfigCandidate | null): Partial<GameConfig> | null {
  if (!candidate) {
    return null;
  }

  if (candidate.config && typeof candidate.config === "object") {
    return candidate.config;
  }

  return candidate;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as BuildRequestBody | null;
  const resolved = resolveWorkflowInput(body, body?.plan?.title ?? "Generated interactive demo");
  const concept = resolved.concept;
  const conceptMode =
    body?.conceptNode?.suggestedMode !== undefined
      ? detectDemoMode(String(body.conceptNode.suggestedMode))
      : detectDemoMode(concept);

  let config = deriveFallbackConfig(concept, body?.plan ?? null);
  config.demonstration.mode = conceptMode;
  let usedLlm = false;

  try {
    const llm = await runLlmBackend({
      provider: "openai",
      model: BUILD_MODEL,
      systemPrompt: BUILD_SYSTEM_PROMPT,
      prompt: buildConfigPrompt(concept, resolved.sourceLabel, body?.plan, body?.conceptNode),
    });

    usedLlm = llm.live;
    const parsed = parseJsonObjectFromText<BuildConfigCandidate>(llm.output);
    const candidate = pickConfigCandidate(parsed);
    if (candidate) {
      config = mergeGameConfig({
        ...candidate,
        demonstration: {
          ...(candidate.demonstration ?? {}),
          mode: conceptMode,
        },
      });
    }
  } catch {
    config = deriveFallbackConfig(concept, body?.plan ?? null);
    config.demonstration.mode = conceptMode;
  }

  let calibration = evaluateGameConfig(config, 20);
  if (calibration.issues.length > 0) {
    config = applyIssueFixes(config, calibration.issues);
    calibration = evaluateGameConfig(config, 20);
  }

  return Response.json({
    ok: true,
    step: "build",
    sourceType: resolved.sourceType,
    usedLlm,
    usedPhysics: true,
    agent: {
      name: "build",
      tools: ["llm-api", "physics-engine-tool"],
    },
    message: `Build complete. Physics calibration recorded ${calibration.metrics.collisions} collisions in ${Math.round(calibration.metrics.completedSeconds)}s.`,
    config,
    calibration,
    received: body,
    timestamp: new Date().toISOString(),
  });
}
