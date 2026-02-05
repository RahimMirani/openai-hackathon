import {
  deriveFallbackConfig,
  mergeGameConfig,
  type GameConfig,
} from "@/lib/workflow/game-config";
import { resolveWorkflowInput, type WorkflowInputShape } from "@/lib/workflow/input";
import { evaluateGameConfig } from "@/lib/workflow/playtest";

type PlaytestRequestBody = WorkflowInputShape & {
  config?: Partial<GameConfig>;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as PlaytestRequestBody | null;
  const resolved = resolveWorkflowInput(body, "Generated interactive demo");
  const concept = resolved.concept;

  const config = mergeGameConfig(body?.config ?? deriveFallbackConfig(concept));
  const evaluation = evaluateGameConfig(config, Math.min(45, config.rules.timer));

  return Response.json({
    ok: true,
    step: "playtest",
    sourceType: resolved.sourceType,
    usedPhysics: true,
    agent: {
      name: "playtest",
      tools: ["physics-engine-tool"],
    },
    message:
      evaluation.issues.length === 0
        ? "Playtest complete. No critical gameplay issues detected."
        : "Playtest complete. Issues detected for the fix agent.",
    issues: evaluation.issues,
    metrics: evaluation.metrics,
    config,
    received: body,
    timestamp: new Date().toISOString(),
  });
}
