import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { installRouteTestHooks } from "./route-test-hooks";

const testRequire = createRequire(__filename);

test("POST /api/game-physics returns simulation output for valid payloads", async () => {
  const restoreHooks = installRouteTestHooks();

  try {
    const { POST } = testRequire("../../src/app/api/game-physics/route") as {
      POST: (request: Request) => Promise<Response>;
    };

    const request = new Request("http://localhost/api/game-physics", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        world: {
          tick: 0,
          elapsedMs: 0,
          gravity: { x: 0, y: 0 },
          bounds: {
            min: { x: 0, y: 0 },
            max: { x: 100, y: 100 },
          },
          bodies: [
            {
              id: "player",
              position: { x: 10, y: 10 },
              velocity: { x: 2, y: 0 },
              halfSize: { x: 1, y: 1 },
              mass: 1,
            },
          ],
        },
      }),
    });

    const response = await POST(request);
    const payload = (await response.json()) as {
      ok: boolean;
      world: { tick: number };
      collisions: unknown[];
    };

    assert.equal(response.status, 200);
    assert.equal(payload.ok, true);
    assert.equal(payload.world.tick, 1);
    assert.ok(Array.isArray(payload.collisions));
  } finally {
    restoreHooks();
  }
});

test("POST /api/game-physics returns 400 for invalid payloads", async () => {
  const restoreHooks = installRouteTestHooks();

  try {
    const { POST } = testRequire("../../src/app/api/game-physics/route") as {
      POST: (request: Request) => Promise<Response>;
    };

    const request = new Request("http://localhost/api/game-physics", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ world: null }),
    });

    const response = await POST(request);
    const payload = (await response.json()) as {
      ok: boolean;
      error: string;
    };

    assert.equal(response.status, 400);
    assert.equal(payload.ok, false);
    assert.match(payload.error, /world must be an object/i);
  } finally {
    restoreHooks();
  }
});
