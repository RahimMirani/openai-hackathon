import assert from "node:assert/strict";
import test from "node:test";
import { runPhysicsSimulation } from "../../src/lib/game-physics/engine";
import type { PhysicsBody, PhysicsWorldState } from "../../src/lib/game-physics/types";

function approxEqual(actual: number, expected: number, epsilon = 1e-6): void {
  assert.ok(
    Math.abs(actual - expected) <= epsilon,
    `Expected ${actual} to be within ${epsilon} of ${expected}`,
  );
}

function createWorld(bodies: PhysicsBody[]): PhysicsWorldState {
  return {
    tick: 0,
    elapsedMs: 0,
    gravity: { x: 0, y: 0 },
    bounds: {
      min: { x: 0, y: 0 },
      max: { x: 10, y: 10 },
    },
    defaultRestitution: 1,
    defaultFriction: 0,
    defaultLinearDamping: 0,
    bodies,
  };
}

test("runPhysicsSimulation does not mutate input world and advances time", () => {
  const world = createWorld([
    {
      id: "ball",
      position: { x: 2, y: 3 },
      velocity: { x: 1, y: 0 },
      halfSize: { x: 1, y: 1 },
      mass: 2,
    },
  ]);
  const snapshot = structuredClone(world);

  const result = runPhysicsSimulation({ world, dtMs: 20, steps: 1 });

  assert.deepEqual(world, snapshot);
  assert.equal(result.world.tick, 1);
  assert.equal(result.world.elapsedMs, 20);
  approxEqual(result.world.bodies[0].position.x, 2.02);
});

test("runPhysicsSimulation resolves world-bound collisions", () => {
  const world = createWorld([
    {
      id: "runner",
      position: { x: 8.9, y: 5 },
      velocity: { x: 5, y: 0 },
      halfSize: { x: 1, y: 1 },
      mass: 1,
    },
  ]);

  const result = runPhysicsSimulation({ world, dtMs: 100, steps: 1 });
  const body = result.world.bodies[0];
  const worldCollision = result.collisions.find((entry) => entry.bId === "__world__");

  assert.ok(worldCollision);
  assert.ok(body.velocity.x < 0);
  approxEqual(body.position.x, 9);
});

test("runPhysicsSimulation resolves dynamic body-body collisions", () => {
  const world = createWorld([
    {
      id: "a",
      position: { x: 4, y: 5 },
      velocity: { x: 10, y: 0 },
      halfSize: { x: 1, y: 1 },
      mass: 1,
      restitution: 1,
      friction: 0,
      linearDamping: 0,
    },
    {
      id: "b",
      position: { x: 6, y: 5 },
      velocity: { x: -10, y: 0 },
      halfSize: { x: 1, y: 1 },
      mass: 1,
      restitution: 1,
      friction: 0,
      linearDamping: 0,
    },
  ]);

  const result = runPhysicsSimulation({ world, dtMs: 20, steps: 1 });
  const bodyA = result.world.bodies.find((body) => body.id === "a");
  const bodyB = result.world.bodies.find((body) => body.id === "b");
  const pairCollision = result.collisions.find(
    (entry) => entry.aId === "a" && entry.bId === "b",
  );

  assert.ok(pairCollision);
  assert.ok(bodyA);
  assert.ok(bodyB);
  assert.ok(bodyA.velocity.x < 0);
  assert.ok(bodyB.velocity.x > 0);
  approxEqual(bodyA.velocity.x, -10);
  approxEqual(bodyB.velocity.x, 10);
});
