export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { prompt?: string; fileName?: string | null; plan?: { title?: string } }
    | null;
  const prompt = body?.prompt?.trim() || body?.plan?.title || "Generated Game";
  const intensity = Math.min(10, Math.max(4, Math.ceil(prompt.length / 12)));

  return Response.json({
    ok: true,
    step: "build",
    message: "Build artifacts assembled.",
    config: {
      title: prompt,
      goal: "Survive the obstacle stream until the timer ends.",
      player: {
        speed: 220 + intensity * 6,
        radius: 14,
        color: "#1f5b57",
      },
      obstacles: {
        count: intensity,
        speed: 100 + intensity * 10,
        radius: 12,
        color: "#b4552d",
      },
      arena: {
        width: 960,
        height: 540,
        background: "#fbfaf7",
      },
      rules: {
        lives: 3,
        timer: 60,
      },
    },
    received: body,
    timestamp: new Date().toISOString(),
  });
}
