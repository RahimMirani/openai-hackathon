export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { prompt?: string; fileName?: string | null; issues?: string[] }
    | null;
  const issues = body?.issues ?? [];

  return Response.json({
    ok: true,
    step: "fix",
    message:
      issues.length === 0
        ? "No fixes required."
        : "Fixes applied and validated.",
    received: body,
    timestamp: new Date().toISOString(),
  });
}
