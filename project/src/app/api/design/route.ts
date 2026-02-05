export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { prompt?: string; fileName?: string | null }
    | null;
  const prompt = body?.prompt?.trim() || "Untitled game";

  return Response.json({
    ok: true,
    step: "design",
    message: "Design spec generated.",
    plan: {
      title: prompt,
      mechanics: ["movement", "obstacles", "timer"],
      winCondition: "Survive until the timer ends.",
      failCondition: "Run out of lives.",
    },
    received: body,
    timestamp: new Date().toISOString(),
  });
}
