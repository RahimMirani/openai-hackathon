export type DemoOption = {
  id: string;
  title: string;
  gameplayLoop: string;
  winCondition: string;
  failCondition: string;
  whyItFits: string;
};

export type SyllabusExtractionResult = {
  fileName: string;
  prompt: string;
  summary: string;
  keyConcepts: string[];
  progression: string[];
  options: DemoOption[];
  recommendedOptionId?: string;
};

export const SYLLABUS_EXTRACTION_PROMPT = `
You are the Game Design Agent for an autonomous game engineering system.
Given syllabus text, extract only mechanic-relevant signals.

Output requirements:
1) Summarize gameplay-relevant intent in one short paragraph.
2) Extract key concepts that can map to mechanics, constraints, and game states.
3) Infer a progression path that can become level flow or phase transitions.
4) Propose exactly 3 interactive demo options, each with:
   - Title
   - Core gameplay loop
   - Win condition
   - Fail condition
   - Why this option matches the syllabus

Do not generate educational prose. Focus only on playable system design.
`.trim();

const STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "from",
  "into",
  "your",
  "you",
  "are",
  "was",
  "were",
  "have",
  "has",
  "had",
  "not",
  "but",
  "can",
  "will",
  "should",
  "could",
  "would",
  "about",
  "over",
  "under",
  "through",
  "during",
  "after",
  "before",
  "only",
  "then",
  "than",
  "also",
  "each",
  "more",
  "most",
  "some",
  "such",
  "their",
  "them",
  "they",
  "our",
  "out",
  "use",
  "using",
  "used",
  "make",
  "build",
  "create",
  "game",
  "system",
  "player",
  "players",
  "level",
  "levels",
]);

function normalizeText(input: string): string {
  return input
    .replace(/\r\n/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function sentenceSplit(input: string): string[] {
  return input
    .split(/(?<=[.!?])\s+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function collectProgression(text: string): string[] {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const listCandidates = lines.filter((line) =>
    /^(\d+[\).\s-]|[-*•])\s+/.test(line),
  );

  if (listCandidates.length >= 3) {
    return listCandidates
      .slice(0, 6)
      .map((line) => line.replace(/^(\d+[\).\s-]|[-*•])\s+/, "").trim());
  }

  return sentenceSplit(text).slice(0, 6);
}

function collectConcepts(text: string): string[] {
  const terms = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOPWORDS.has(word));

  const score = new Map<string, number>();
  for (const term of terms) {
    score.set(term, (score.get(term) ?? 0) + 1);
  }

  return [...score.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([term]) => term);
}

function buildSummary(text: string, concepts: string[]): string {
  const head = sentenceSplit(text)[0];
  if (head) {
    return head;
  }

  if (concepts.length === 0) {
    return "Syllabus uploaded. Mechanics can be derived after adding more structured content.";
  }

  return `Syllabus centers on ${concepts.slice(0, 4).join(", ")}, which can be mapped into mechanic-driven gameplay loops.`;
}

function toOptionId(title: string, index: number): string {
  const slug = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug ? `option-${slug}` : `option-${index + 1}`;
}

function toList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => String(item).trim()).filter(Boolean);
}

function parseStructuredSyllabus(rawText: string): {
  summary: string;
  keyConcepts: string[];
  progression: string[];
  options: DemoOption[];
  recommendedOptionId?: string;
} | null {
  const trimmed = rawText.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
  const candidate = fenced ?? trimmed;

  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== "object") {
    return null;
  }

  const root = parsed as Record<string, unknown>;
  const demos = Array.isArray(root.interactive_demos) ? root.interactive_demos : [];
  if (demos.length === 0) {
    return null;
  }

  const options: DemoOption[] = demos
    .map((demo, index) => {
      if (!demo || typeof demo !== "object") {
        return null;
      }
      const d = demo as Record<string, unknown>;
      const title = String(d.title ?? "").trim();
      if (!title) {
        return null;
      }

      const mechanic = String(d.core_mechanic ?? "Interactive simulation").trim();
      const keyInputs = toList(d.key_inputs);
      const inputLine = keyInputs.length > 0 ? ` Inputs: ${keyInputs.join("; ")}.` : "";

      const why = String(d.what_it_teaches ?? "Aligned to extracted syllabus goals.").trim();
      const complexity = String(d.build_complexity ?? "").trim();
      const hours = d.estimated_build_time_hours;
      const buildLine =
        complexity || typeof hours === "number"
          ? ` Build: ${complexity || "unknown"}${typeof hours === "number" ? `, ${hours}h` : ""}.`
          : "";

      return {
        id: toOptionId(title, index),
        title,
        gameplayLoop: `${mechanic}.${inputLine}`.trim(),
        winCondition: String(d.success_condition ?? "Complete the scenario objective.").trim(),
        failCondition: String(d.failure_condition ?? "Fail to satisfy required conditions.").trim(),
        whyItFits: `${why}${buildLine}`.trim(),
      };
    })
    .filter((option): option is DemoOption => option !== null);

  if (options.length === 0) {
    return null;
  }

  const syllabusSummary =
    root.syllabus_summary && typeof root.syllabus_summary === "object"
      ? (root.syllabus_summary as Record<string, unknown>)
      : null;

  const topConcepts = toList(syllabusSummary?.top_concepts);
  const summary =
    topConcepts.length > 0
      ? `Syllabus focus: ${topConcepts.slice(0, 3).join(" | ")}.`
      : "Syllabus extracted into interactive demo candidates.";

  const keyConcepts =
    topConcepts.length > 0
      ? topConcepts
      : demos
          .flatMap((demo) =>
            demo && typeof demo === "object"
              ? toList((demo as Record<string, unknown>).concepts_covered)
              : [],
          )
          .slice(0, 8);

  const progression = options.map((option) => option.title);

  let recommendedOptionId: string | undefined;
  if (root.recommended_first_demo && typeof root.recommended_first_demo === "object") {
    const recommendedTitle = String(
      (root.recommended_first_demo as Record<string, unknown>).title ?? "",
    ).trim();
    if (recommendedTitle) {
      const matched = options.find(
        (option) => option.title.toLowerCase() === recommendedTitle.toLowerCase(),
      );
      recommendedOptionId = matched?.id;
    }
  }

  return {
    summary,
    keyConcepts,
    progression,
    options,
    recommendedOptionId,
  };
}

function buildOptions(concepts: string[], progression: string[]): DemoOption[] {
  const conceptSummary = concepts.slice(0, 4).join(", ") || "core concepts";
  const firstPhase = progression[0] ?? "phase 1";
  const secondPhase = progression[1] ?? "phase 2";
  const thirdPhase = progression[2] ?? "phase 3";

  return [
    {
      id: "option-runner",
      title: "Momentum Runner",
      gameplayLoop: `Navigate hazards while adapting mechanics tied to ${conceptSummary}. Phases unlock as the run advances through ${firstPhase}, ${secondPhase}, and ${thirdPhase}.`,
      winCondition: "Reach the final zone with at least one life and required score threshold.",
      failCondition: "Lose all lives or run out of time before the final phase.",
      whyItFits: "Supports clear progression and deterministic real-time interaction.",
    },
    {
      id: "option-resource",
      title: "Constraint Manager",
      gameplayLoop: `Balance limited resources and actions across staged scenarios informed by ${conceptSummary}. Each stage adds one new constraint.`,
      winCondition: "Maintain stability metrics above threshold for all stages.",
      failCondition: "Critical metric drops below threshold in any stage.",
      whyItFits: "Matches syllabus structures that introduce concepts in sequenced layers.",
    },
    {
      id: "option-routing",
      title: "Logic Routing Puzzle",
      gameplayLoop: `Route signals through modular nodes representing ${conceptSummary}. Solve increasingly strict layouts derived from syllabus progression.`,
      winCondition: "Complete all routes with valid constraints and no conflict nodes.",
      failCondition: "Invalid route causes system lock or exceeds allowed moves.",
      whyItFits: "Works well for concept-linking and explicit state transitions.",
    },
  ];
}

export function runSyllabusExtractionPipeline(
  fileName: string,
  rawText: string,
): SyllabusExtractionResult {
  const structured = parseStructuredSyllabus(rawText);
  if (structured) {
    return {
      fileName,
      prompt: SYLLABUS_EXTRACTION_PROMPT,
      summary: structured.summary,
      keyConcepts: structured.keyConcepts,
      progression: structured.progression,
      options: structured.options,
      recommendedOptionId: structured.recommendedOptionId,
    };
  }

  const normalized = normalizeText(rawText);
  const keyConcepts = collectConcepts(normalized);
  const progression = collectProgression(normalized);

  return {
    fileName,
    prompt: SYLLABUS_EXTRACTION_PROMPT,
    summary: buildSummary(normalized, keyConcepts),
    keyConcepts,
    progression,
    options: buildOptions(keyConcepts, progression),
  };
}
