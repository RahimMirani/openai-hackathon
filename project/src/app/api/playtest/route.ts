export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { prompt?: string; fileName?: string | null }
    | null;
  const prompt = body?.prompt ?? "";
  const issues =
    prompt.length % 2 === 0
      ? ["Obstacle speed spikes too quickly."]
      : [];

  return Response.json({
    ok: true,
    step: "playtest",
    message:
      issues.length === 0
        ? "Playtest run complete. No critical issues."
        : "Playtest run complete. Issues detected.",
    issues,
    received: body,
    timestamp: new Date().toISOString(),
  });
}
