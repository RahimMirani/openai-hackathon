import { NextResponse } from "next/server";
import { runGamePhysicsTool } from "@/lib/game-physics";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as unknown;
    const result = runGamePhysicsTool(payload);
    return NextResponse.json({
      ok: true,
      world: result.world,
      collisions: result.collisions,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Invalid physics request.";
    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 400 },
    );
  }
}
