function parseCandidate<T>(candidate: string): T | null {
  try {
    const parsed = JSON.parse(candidate) as unknown;
    if (parsed && typeof parsed === "object") {
      return parsed as T;
    }
  } catch {
    return null;
  }

  return null;
}

export function parseJsonObjectFromText<T>(text: string): T | null {
  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }

  const candidates: string[] = [trimmed];
  const fencedPattern = /```(?:json)?\s*([\s\S]*?)```/gi;
  let fencedMatch = fencedPattern.exec(trimmed);

  while (fencedMatch) {
    candidates.push(fencedMatch[1].trim());
    fencedMatch = fencedPattern.exec(trimmed);
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    candidates.push(trimmed.slice(firstBrace, lastBrace + 1));
  }

  for (const candidate of candidates) {
    const parsed = parseCandidate<T>(candidate);
    if (parsed) {
      return parsed;
    }
  }

  return null;
}
