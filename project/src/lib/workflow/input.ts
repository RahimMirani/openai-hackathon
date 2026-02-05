export type WorkflowSourceType = "prompt" | "syllabus";

export type WorkflowInputShape = {
  prompt?: string | null;
  syllabusText?: string | null;
  sourceType?: WorkflowSourceType | string | null;
  fileName?: string | null;
};

export type ResolvedWorkflowInput = {
  concept: string;
  sourceType: WorkflowSourceType;
  sourceLabel: string;
  syllabusText: string;
  promptText: string;
};

const MAX_SYLLABUS_CHARS = 12000;

export function normalizeSyllabusText(raw: string, maxChars = MAX_SYLLABUS_CHARS): string {
  const sanitized = raw
    .replace(/\u0000/g, " ")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, " ");

  return sanitized
    .replace(/\r/g, "\n")
    .split(/\n+/)
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
    .slice(0, maxChars);
}

export function resolveWorkflowInput(
  input: WorkflowInputShape | null | undefined,
  fallback = "Generated interactive demo",
): ResolvedWorkflowInput {
  const promptText = input?.prompt?.trim() ?? "";
  const syllabusText = normalizeSyllabusText(input?.syllabusText ?? "");
  const requestedSource = input?.sourceType;

  if (requestedSource === "syllabus" && syllabusText) {
    return {
      concept: syllabusText,
      sourceType: "syllabus",
      sourceLabel: input?.fileName ? `syllabus:${input.fileName}` : "syllabus",
      syllabusText,
      promptText,
    };
  }

  if (promptText) {
    return {
      concept: promptText,
      sourceType: "prompt",
      sourceLabel: "prompt",
      syllabusText,
      promptText,
    };
  }

  if (syllabusText) {
    return {
      concept: syllabusText,
      sourceType: "syllabus",
      sourceLabel: input?.fileName ? `syllabus:${input.fileName}` : "syllabus",
      syllabusText,
      promptText,
    };
  }

  return {
    concept: fallback,
    sourceType: "prompt",
    sourceLabel: "fallback",
    syllabusText,
    promptText,
  };
}

export function llmConceptExcerpt(concept: string, maxChars = 4000): string {
  if (concept.length <= maxChars) {
    return concept;
  }

  return `${concept.slice(0, maxChars)}\n[truncated]`;
}
