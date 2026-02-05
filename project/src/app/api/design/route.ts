import { runLlmBackend } from "@/lib/llm/backend";
import { getAgentSystemPrompt } from "@/lib/agents/system-prompts";
import {
  deriveFallbackDesignPlan,
  mergeDesignPlan,
  type DesignPlan,
} from "@/lib/workflow/game-config";
import {
  mergeConceptNodes,
  type ConceptNode,
} from "@/lib/workflow/concepts";
import {
  llmConceptExcerpt,
  resolveWorkflowInput,
  type WorkflowInputShape,
} from "@/lib/workflow/input";
import { parseJsonObjectFromText } from "@/lib/workflow/json";

const DESIGN_MODEL = "gpt-4.1-mini";
const DESIGN_SYSTEM_PROMPT = getAgentSystemPrompt(
  "design",
  "You are the Design Agent. Produce concise, valid JSON design plans.",
);

type DesignRequestBody = WorkflowInputShape;

type DesignCandidate = Partial<DesignPlan> & {
  plan?: Partial<DesignPlan>;
  concepts?: unknown;
};

function buildDesignPrompt(
  concept: string,
  sourceLabel: string,
  fileName: string | null,
): string {
  return [
    "You are the Game Design Agent for an autonomous game workflow.",
    "Convert the source into a concise design plan and concept breakdown for generated learning mini-games.",
    "The final output must be derived from the provided source input.",
    "Return JSON only with this shape:",
    "{",
    '  "plan": {',
    '    "title": string,',
    '    "concept": string,',
    '    "mechanics": string[],',
    '    "winCondition": string,',
    '    "failCondition": string,',
    '    "difficulty": number',
    "  },",
    '  "concepts": [',
    "    {",
    '      "id": string,',
    '      "title": string,',
    '      "objective": string,',
    '      "focusPrompt": string,',
    '      "suggestedMode": "gravity"|"collision"|"projectile"',
    "    }",
    "  ]",
    "}",
    "Keep concepts distinct and practical for separate mini-games (2-4 items).",
    `Source: ${sourceLabel}`,
    `Concept input: ${llmConceptExcerpt(concept)}`,
    `Attached file name: ${fileName ?? "none"}`,
  ].join("\n");
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as DesignRequestBody | null;
  const resolved = resolveWorkflowInput(body, "Untitled interactive physics concept");
  const concept = resolved.concept;

  let plan: DesignPlan = deriveFallbackDesignPlan(concept);
  let concepts: ConceptNode[] = mergeConceptNodes(null, concept);
  let usedLlm = false;

  try {
    const llm = await runLlmBackend({
      provider: "openai",
      model: DESIGN_MODEL,
      systemPrompt: DESIGN_SYSTEM_PROMPT,
      prompt: buildDesignPrompt(concept, resolved.sourceLabel, body?.fileName ?? null),
    });

    usedLlm = llm.live;
    const parsed = parseJsonObjectFromText<DesignCandidate>(llm.output);
    const planCandidate = parsed?.plan ?? parsed;
    plan = mergeDesignPlan(planCandidate, concept);
    concepts = mergeConceptNodes(parsed?.concepts, concept);
  } catch {
    plan = deriveFallbackDesignPlan(concept);
    concepts = mergeConceptNodes(null, concept);
  }

  return Response.json({
    ok: true,
    step: "design",
    sourceType: resolved.sourceType,
    usedLlm,
    message: usedLlm
      ? "Design plan and concept decomposition generated with OpenAI analysis."
      : "Design plan and concept decomposition generated with deterministic fallback.",
    agent: {
      name: "design",
      tools: ["llm-api", "concept-decomposer"],
    },
    plan,
    concepts,
    received: body,
    timestamp: new Date().toISOString(),
  });
}
