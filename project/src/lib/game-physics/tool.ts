import { runPhysicsSimulation } from "./engine";
import {
  PhysicsAction,
  PhysicsBody,
  PhysicsSimulationRequest,
  PhysicsSimulationResult,
  PhysicsWorldState,
  Vector2,
} from "./types";

const MAX_BODIES = 300;
const MAX_ACTIONS = 100;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toFiniteNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  return fallback;
}

function readVector(
  value: unknown,
  fallback: Vector2 = { x: 0, y: 0 },
): Vector2 {
  if (!isObject(value)) {
    return fallback;
  }
  return {
    x: toFiniteNumber(value.x, fallback.x),
    y: toFiniteNumber(value.y, fallback.y),
  };
}

function normalizeBody(value: unknown, index: number): PhysicsBody {
  if (!isObject(value)) {
    throw new Error(`Body at index ${index} must be an object.`);
  }

  const id = typeof value.id === "string" ? value.id.trim() : "";
  if (!id) {
    throw new Error(`Body at index ${index} is missing a valid id.`);
  }

  const mass = Math.max(toFiniteNumber(value.mass, 1), 0.0001);
  const halfSize = readVector(value.halfSize, { x: 0.5, y: 0.5 });

  return {
    id,
    position: readVector(value.position),
    velocity: readVector(value.velocity),
    halfSize: {
      x: Math.max(Math.abs(halfSize.x), 0.0001),
      y: Math.max(Math.abs(halfSize.y), 0.0001),
    },
    mass,
    isStatic: Boolean(value.isStatic),
    restitution: toFiniteNumber(value.restitution, 0.25),
    friction: toFiniteNumber(value.friction, 0.2),
    linearDamping: toFiniteNumber(value.linearDamping, 0.02),
    tag: typeof value.tag === "string" ? value.tag : undefined,
  };
}

function normalizeAction(value: unknown, index: number): PhysicsAction {
  if (!isObject(value) || typeof value.type !== "string") {
    throw new Error(`Action at index ${index} must include a valid type.`);
  }

  const type = value.type;
  if (type === "spawnBody") {
    return {
      type,
      body: normalizeBody(value.body, index),
    };
  }

  if (type === "removeBody") {
    const bodyId = typeof value.bodyId === "string" ? value.bodyId.trim() : "";
    if (!bodyId) {
      throw new Error(`removeBody action at index ${index} requires bodyId.`);
    }
    return { type, bodyId };
  }

  const bodyId = typeof value.bodyId === "string" ? value.bodyId.trim() : "";
  if (!bodyId) {
    throw new Error(`Action at index ${index} requires a valid bodyId.`);
  }

  if (type === "applyImpulse") {
    return { type, bodyId, impulse: readVector(value.impulse) };
  }

  if (type === "applyForce") {
    return { type, bodyId, force: readVector(value.force) };
  }

  if (type === "setVelocity") {
    return { type, bodyId, velocity: readVector(value.velocity) };
  }

  if (type === "teleport") {
    return { type, bodyId, position: readVector(value.position) };
  }

  throw new Error(`Unknown action type "${type}" at index ${index}.`);
}

function normalizeWorld(value: unknown): PhysicsWorldState {
  if (!isObject(value)) {
    throw new Error("world must be an object.");
  }

  const rawBodies = Array.isArray(value.bodies) ? value.bodies : [];
  if (rawBodies.length > MAX_BODIES) {
    throw new Error(`world.bodies exceeds limit of ${MAX_BODIES}.`);
  }

  const bodies = rawBodies.map((body, index) => normalizeBody(body, index));

  const idSet = new Set<string>();
  for (const body of bodies) {
    if (idSet.has(body.id)) {
      throw new Error(`Duplicate body id "${body.id}" in world.bodies.`);
    }
    idSet.add(body.id);
  }

  const bounds = isObject(value.bounds) ? value.bounds : {};
  const min = readVector(bounds.min, { x: 0, y: 0 });
  const max = readVector(bounds.max, { x: 100, y: 100 });

  if (max.x <= min.x || max.y <= min.y) {
    throw new Error("world.bounds.max must be greater than world.bounds.min.");
  }

  return {
    tick: Math.max(Math.round(toFiniteNumber(value.tick, 0)), 0),
    elapsedMs: Math.max(toFiniteNumber(value.elapsedMs, 0), 0),
    gravity: readVector(value.gravity, { x: 0, y: 12 }),
    bounds: { min, max },
    defaultRestitution: toFiniteNumber(value.defaultRestitution, 0.25),
    defaultFriction: toFiniteNumber(value.defaultFriction, 0.2),
    defaultLinearDamping: toFiniteNumber(value.defaultLinearDamping, 0.02),
    bodies,
  };
}

function normalizeRequest(payload: unknown): PhysicsSimulationRequest {
  if (!isObject(payload)) {
    throw new Error("Request payload must be an object.");
  }

  const actionsRaw = Array.isArray(payload.actions) ? payload.actions : [];
  if (actionsRaw.length > MAX_ACTIONS) {
    throw new Error(`actions exceeds limit of ${MAX_ACTIONS}.`);
  }

  return {
    world: normalizeWorld(payload.world),
    actions: actionsRaw.map((action, index) => normalizeAction(action, index)),
    dtMs: toFiniteNumber(payload.dtMs, 16.667),
    steps: Math.max(Math.round(toFiniteNumber(payload.steps, 1)), 1),
  };
}

export function runGamePhysicsTool(payload: unknown): PhysicsSimulationResult {
  const request = normalizeRequest(payload);
  return runPhysicsSimulation(request);
}
