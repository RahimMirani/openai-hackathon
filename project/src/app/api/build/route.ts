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
import {
  GAME_GENERATION_SYSTEM_PROMPT,
  buildGameGenerationPrompt,
  parseGameSpec,
  DEFAULT_GAME_SPEC,
  type GameSpec,
} from "@/lib/game-engine";

const BUILD_MODEL = "gpt-4.1-mini";

type BuildRequestBody = WorkflowInputShape & {
  plan?: Partial<DesignPlan>;
  conceptNode?: Partial<ConceptNode> | null;
  useDynamicEngine?: boolean;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as BuildRequestBody | null;
  const resolved = resolveWorkflowInput(body, body?.plan?.title ?? "Generated interactive demo");
  const concept = resolved.concept;
  const useDynamic = body?.useDynamicEngine ?? true; // Default to new dynamic engine

  let usedLlm = false;

  // ===== NEW DYNAMIC GAME ENGINE =====
  if (useDynamic) {
    let gameSpec: GameSpec = DEFAULT_GAME_SPEC;
    let llmOutput = "";
    let llmError = "";

    try {
      console.log("[BUILD] Starting dynamic game generation for concept:", concept.slice(0, 100));
      
      const llm = await runLlmBackend({
        provider: "openai",
        model: BUILD_MODEL,
        systemPrompt: GAME_GENERATION_SYSTEM_PROMPT,
        prompt: buildGameGenerationPrompt(concept, body?.conceptNode ?? undefined),
      });

      usedLlm = llm.live;
      llmOutput = llm.output;
      
      console.log("[BUILD] LLM responded, live:", llm.live, "output length:", llm.output.length);
      console.log("[BUILD] First 500 chars:", llm.output.slice(0, 500));
      
      const parsed = parseGameSpec(llm.output);
      if (parsed) {
        gameSpec = parsed;
        console.log("[BUILD] Successfully parsed gameSpec with", gameSpec.entities.length, "entities");
      } else {
        console.error("[BUILD] Failed to parse LLM output as GameSpec");
        llmError = "Failed to parse LLM output";
      }
    } catch (error) {
      console.error("[BUILD] Dynamic game generation failed:", error);
      llmError = error instanceof Error ? error.message : String(error);
      // Fall back to default spec
      gameSpec = {
        ...DEFAULT_GAME_SPEC,
        title: body?.conceptNode?.title ?? concept.slice(0, 60),
        objective: body?.conceptNode?.objective ?? `Explore ${concept}`,
        learning: {
          ...DEFAULT_GAME_SPEC.learning,
          concept: concept,
        },
      };
    }

    return Response.json({
      ok: true,
      step: "build",
      sourceType: resolved.sourceType,
      usedLlm,
      usedDynamicEngine: true,
      agent: {
        name: "build",
        tools: ["llm-api", "dynamic-game-engine"],
      },
      message: `Dynamic game generated with ${gameSpec.entities.length} entities and ${gameSpec.controls.length} interactive controls.`,
      gameSpec,
      // Also return legacy config for backwards compatibility
      config: convertSpecToLegacyConfig(gameSpec, concept),
      received: body,
      timestamp: new Date().toISOString(),
      // Debug info
      debug: {
        llmOutputLength: llmOutput.length,
        llmOutputPreview: llmOutput.slice(0, 300),
        llmError: llmError || null,
        conceptUsed: concept.slice(0, 200),
      },
    });
  }

  // ===== LEGACY HARDCODED ENGINE =====
  const conceptMode =
    body?.conceptNode?.suggestedMode !== undefined
      ? detectDemoMode(String(body.conceptNode.suggestedMode))
      : detectDemoMode(concept);

  let config = deriveFallbackConfig(concept, body?.plan ?? null);
  config.demonstration.mode = conceptMode;

  const BUILD_SYSTEM_PROMPT = getAgentSystemPrompt(
    "build",
    "You are the Engineering Agent. Return stable, valid JSON configs.",
  );

  try {
    const llm = await runLlmBackend({
      provider: "openai",
      model: BUILD_MODEL,
      systemPrompt: BUILD_SYSTEM_PROMPT,
      prompt: buildLegacyConfigPrompt(concept, resolved.sourceLabel, body?.plan, body?.conceptNode),
    });

    usedLlm = llm.live;
    const parsed = parseJsonObjectFromText<Partial<GameConfig>>(llm.output);
    if (parsed) {
      config = mergeGameConfig({
        ...parsed,
        demonstration: {
          ...(parsed.demonstration ?? {}),
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
    usedDynamicEngine: false,
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

// Convert new GameSpec to legacy GameConfig for backwards compatibility
function convertSpecToLegacyConfig(spec: GameSpec, concept: string): GameConfig {
  return mergeGameConfig({
    title: spec.title,
    concept: spec.learning.concept,
    goal: spec.objective,
    arena: {
      width: spec.canvas.width,
      height: spec.canvas.height,
      background: spec.canvas.background,
      gridColor: spec.canvas.gridColor ?? "#e9e2d6",
    },
    visualization: {
      showGrid: spec.canvas.showGrid ?? true,
      showTrails: spec.ui.showTrails ?? false,
      showVelocityHints: spec.ui.showVelocityVectors ?? false,
      accent: "#2b6f6a",
    },
    demonstration: {
      mode: "gravity",
      summary: spec.description,
      gravity: spec.physics.gravity.y / 15,
      baseRestitution: spec.physics.restitution,
      spawnHeight: 100,
    },
    learning: {
      sidebarTitle: "Learning Guide",
      coachPrompt: spec.ui.customInstructions ?? "Experiment with the controls to explore the concept.",
      tutorTips: spec.learning.tips,
      checkpoints: spec.learning.checkpoints,
      equationAnnotations: spec.learning.equations.map((eq, i) => ({
        id: `eq-${i}`,
        label: eq.name,
        equation: eq.formula,
        explanation: eq.explanation,
        variables: eq.variables,
      })),
    },
  });
}

function buildLegacyConfigPrompt(
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
    "Return JSON only with this shape:",
    '{ "title": string, "concept": string, "goal": string, ... }',
    `Suggested mode: ${suggestedMode}`,
    `Concept: ${llmConceptExcerpt(concept)}`,
    `Plan: ${JSON.stringify(plan ?? {})}`,
  ].join("\n");
}
