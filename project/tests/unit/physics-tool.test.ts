import assert from "node:assert/strict";
import test from "node:test";
import { runGamePhysicsTool } from "../../src/lib/game-physics/tool";
import type { PhysicsAction } from "../../src/lib/game-physics";

function createBody(id: string) {
  return {
    id,
    position: { x: 1, y: 1 },
    velocity: { x: 0, y: 0 },
    halfSize: { x: 1, y: 1 },
    mass: 1,
  };
}

type ToolPayload = {
  world: {
    tick: number;
    elapsedMs: number;
    gravity: { x: number; y: number };
    bounds: {
      min: { x: number; y: number };
      max: { x: number; y: number };
    };
    bodies: ReturnType<typeof createBody>[];
  };
  actions: PhysicsAction[] | Array<Record<string, unknown>>;
  dtMs: number;
  steps: number;
};

function createPayload(): ToolPayload {
  return {
    world: {
      tick: 0,
      elapsedMs: 0,
      gravity: { x: 0, y: 0 },
      bounds: {
        min: { x: 0, y: 0 },
        max: { x: 20, y: 20 },
      },
      bodies: [createBody("base")],
    },
    actions: [],
    dtMs: 16.667,
    steps: 1,
  };
}

test("runGamePhysicsTool validates world payload", () => {
  assert.throws(() => runGamePhysicsTool({}), /world must be an object\./);
});

test("runGamePhysicsTool rejects duplicate body ids", () => {
  const payload = createPayload();
  payload.world.bodies.push(createBody("base"));

  assert.throws(
    () => runGamePhysicsTool(payload),
    /Duplicate body id "base" in world\.bodies\./,
  );
});

test("runGamePhysicsTool rejects unknown action types", () => {
  const payload = createPayload();
  payload.actions = [{ type: "dance", bodyId: "base" }];

  assert.throws(
    () => runGamePhysicsTool(payload),
    /Unknown action type "dance" at index 0\./,
  );
});

test("runGamePhysicsTool enforces action and body limits", () => {
  const overActionsPayload = createPayload();
  overActionsPayload.actions = Array.from({ length: 101 }, () => ({
    type: "removeBody",
    bodyId: "base",
  }));
  assert.throws(
    () => runGamePhysicsTool(overActionsPayload),
    /actions exceeds limit of 100\./,
  );

  const overBodiesPayload = createPayload();
  overBodiesPayload.world.bodies = Array.from({ length: 301 }, (_, index) =>
    createBody(`b-${index}`),
  );
  assert.throws(
    () => runGamePhysicsTool(overBodiesPayload),
    /world\.bodies exceeds limit of 300\./,
  );
});

test("runGamePhysicsTool normalizes malformed body values", () => {
  const payload = createPayload();
  payload.world.bodies = [
    {
      id: "player",
      position: { x: 0, y: 0 },
      velocity: { x: 0, y: 0 },
      halfSize: { x: -2, y: 0 },
      mass: 0,
    },
  ];

  const result = runGamePhysicsTool(payload);
  const body = result.world.bodies[0];

  assert.equal(body.mass, 0.0001);
  assert.equal(body.halfSize.x, 2);
  assert.equal(body.halfSize.y, 0.0001);
});

test("runGamePhysicsTool applies spawn and remove actions", () => {
  const payload = createPayload();
  payload.actions = [
    {
      type: "spawnBody",
      body: createBody("spawned"),
    },
    {
      type: "removeBody",
      bodyId: "base",
    },
  ];

  const result = runGamePhysicsTool(payload);
  const ids = result.world.bodies.map((body) => body.id).sort();

  assert.deepEqual(ids, ["spawned"]);
});
