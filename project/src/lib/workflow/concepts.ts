import { detectDemoMode, type DemoMode } from "@/lib/workflow/game-config";

export type ConceptNode = {
  id: string;
  title: string;
  objective: string;
  focusPrompt: string;
  suggestedMode: DemoMode;
};

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

  return slug || "concept";
}

function uniqueById(concepts: ConceptNode[]): ConceptNode[] {
  const seen = new Set<string>();
  const unique: ConceptNode[] = [];

  for (const concept of concepts) {
    if (seen.has(concept.id)) {
      continue;
    }
    seen.add(concept.id);
    unique.push(concept);
  }

  return unique;
}

function lineToConcept(line: string, index: number): ConceptNode {
  const compact = line.replace(/\s+/g, " ").trim();
  const objective = compact.slice(0, 220);
  const titleWords = compact.split(" ").slice(0, 8).join(" ");
  const title = titleWords.length > 6 ? titleWords : `Concept ${index + 1}`;
  const suggestedMode = detectDemoMode(compact);

  return {
    id: `${slugify(title)}-${index + 1}`,
    title,
    objective,
    focusPrompt: `Teach "${objective}" through an interactive ${suggestedMode} physics mini-game with equation annotations.`,
    suggestedMode,
  };
}

function normalizeConceptNode(value: unknown, index: number): ConceptNode | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<ConceptNode>;
  const title = safeString(candidate.title).slice(0, 100);
  const objective = safeString(candidate.objective).slice(0, 220);
  const promptText = safeString(candidate.focusPrompt).slice(0, 320);

  if (!title || !objective) {
    return null;
  }

  const suggestedMode = detectDemoMode(
    [safeString((candidate as Record<string, unknown>).suggestedMode), title, objective].join(" "),
  );

  return {
    id: safeString(candidate.id) || `${slugify(title)}-${index + 1}`,
    title,
    objective,
    focusPrompt:
      promptText ||
      `Teach "${objective}" through an interactive ${suggestedMode} physics mini-game with equation annotations.`,
    suggestedMode,
  };
}

export function deriveFallbackConceptNodes(source: string, maxConcepts = 4): ConceptNode[] {
  const segments = source
    .replace(/\r/g, "\n")
    .split(/\n+/)
    .flatMap((line) => line.split(/[.;!?]/))
    .map((entry) => entry.replace(/^[-*0-9.)\s]+/, "").trim())
    .filter((entry) => entry.length >= 24);

  const selected = (segments.length > 0 ? segments : [source.trim()])
    .filter(Boolean)
    .slice(0, maxConcepts);

  const concepts = selected.map((segment, index) => lineToConcept(segment, index));

  if (concepts.length > 0) {
    return uniqueById(concepts);
  }

  return [
    {
      id: "core-concept-1",
      title: "Core Concept",
      objective: "Build a concept-focused interactive physics learning game.",
      focusPrompt:
        "Build a concept-focused interactive physics learning game with equation annotations.",
      suggestedMode: "gravity",
    },
  ];
}

export function mergeConceptNodes(
  incoming: unknown,
  source: string,
  maxConcepts = 4,
): ConceptNode[] {
  const fallback = deriveFallbackConceptNodes(source, maxConcepts);

  if (!Array.isArray(incoming)) {
    return fallback;
  }

  const merged = incoming
    .map((entry, index) => normalizeConceptNode(entry, index))
    .filter((entry): entry is ConceptNode => Boolean(entry))
    .slice(0, maxConcepts);

  if (merged.length === 0) {
    return fallback;
  }

  return uniqueById(merged).map((concept, index) => ({
    ...concept,
    id: concept.id || `${slugify(concept.title)}-${index + 1}`,
  }));
}
