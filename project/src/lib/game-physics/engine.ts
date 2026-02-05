import {
  CollisionEvent,
  PhysicsAction,
  PhysicsBody,
  PhysicsSimulationRequest,
  PhysicsSimulationResult,
  PhysicsWorldState,
  Vector2,
} from "./types";
import { clamp, dot, normalize, scale, subtract } from "./math";

const DEFAULT_DT_MS = 16.667;
const DEFAULT_STEPS = 1;
const MIN_DT_MS = 1;
const MAX_DT_MS = 100;
const MAX_STEPS = 32;

function cloneBody(body: PhysicsBody): PhysicsBody {
  return {
    ...body,
    position: { ...body.position },
    velocity: { ...body.velocity },
    halfSize: { ...body.halfSize },
  };
}

function cloneWorld(world: PhysicsWorldState): PhysicsWorldState {
  return {
    ...world,
    gravity: { ...world.gravity },
    bounds: {
      min: { ...world.bounds.min },
      max: { ...world.bounds.max },
    },
    bodies: world.bodies.map(cloneBody),
  };
}

function getBodyRestitution(world: PhysicsWorldState, body: PhysicsBody): number {
  const value = body.restitution ?? world.defaultRestitution ?? 0.25;
  return clamp(value, 0, 1);
}

function getBodyFriction(world: PhysicsWorldState, body: PhysicsBody): number {
  const value = body.friction ?? world.defaultFriction ?? 0.2;
  return clamp(value, 0, 1);
}

function getBodyLinearDamping(world: PhysicsWorldState, body: PhysicsBody): number {
  const value = body.linearDamping ?? world.defaultLinearDamping ?? 0.02;
  return clamp(value, 0, 1);
}

function isDynamic(body: PhysicsBody): boolean {
  return !body.isStatic;
}

function bodyInverseMass(body: PhysicsBody): number {
  if (!isDynamic(body)) {
    return 0;
  }

  return body.mass > 0 ? 1 / body.mass : 1;
}

function applyAction(
  world: PhysicsWorldState,
  bodyById: Map<string, PhysicsBody>,
  action: PhysicsAction,
  dtSeconds: number,
): void {
  if (action.type === "spawnBody") {
    const incomingBody = cloneBody(action.body);
    if (!incomingBody.id || bodyById.has(incomingBody.id)) {
      return;
    }
    world.bodies.push(incomingBody);
    bodyById.set(incomingBody.id, incomingBody);
    return;
  }

  if (action.type === "removeBody") {
    const target = bodyById.get(action.bodyId);
    if (!target) {
      return;
    }
    bodyById.delete(action.bodyId);
    world.bodies = world.bodies.filter((body) => body.id !== action.bodyId);
    return;
  }

  const target = bodyById.get(action.bodyId);
  if (!target || !isDynamic(target)) {
    return;
  }

  const inverseMass = bodyInverseMass(target);

  switch (action.type) {
    case "applyImpulse": {
      target.velocity.x += action.impulse.x * inverseMass;
      target.velocity.y += action.impulse.y * inverseMass;
      break;
    }
    case "applyForce": {
      target.velocity.x += action.force.x * inverseMass * dtSeconds;
      target.velocity.y += action.force.y * inverseMass * dtSeconds;
      break;
    }
    case "setVelocity": {
      target.velocity = { ...action.velocity };
      break;
    }
    case "teleport": {
      target.position = { ...action.position };
      break;
    }
  }
}

function resolveWorldCollision(
  world: PhysicsWorldState,
  body: PhysicsBody,
  collisions: CollisionEvent[],
): void {
  if (!isDynamic(body)) {
    return;
  }

  const left = body.position.x - body.halfSize.x;
  const right = body.position.x + body.halfSize.x;
  const top = body.position.y - body.halfSize.y;
  const bottom = body.position.y + body.halfSize.y;

  const restitution = getBodyRestitution(world, body);
  const friction = getBodyFriction(world, body);
  const frictionFactor = clamp(1 - friction, 0, 1);

  if (left < world.bounds.min.x) {
    const depth = world.bounds.min.x - left;
    body.position.x += depth;
    if (body.velocity.x < 0) {
      body.velocity.x = -body.velocity.x * restitution;
      body.velocity.y *= frictionFactor;
    }
    collisions.push({
      aId: body.id,
      bId: "__world__",
      normal: { x: 1, y: 0 },
      depth,
      relativeSpeed: Math.abs(body.velocity.x),
    });
  }

  if (right > world.bounds.max.x) {
    const depth = right - world.bounds.max.x;
    body.position.x -= depth;
    if (body.velocity.x > 0) {
      body.velocity.x = -body.velocity.x * restitution;
      body.velocity.y *= frictionFactor;
    }
    collisions.push({
      aId: body.id,
      bId: "__world__",
      normal: { x: -1, y: 0 },
      depth,
      relativeSpeed: Math.abs(body.velocity.x),
    });
  }

  if (top < world.bounds.min.y) {
    const depth = world.bounds.min.y - top;
    body.position.y += depth;
    if (body.velocity.y < 0) {
      body.velocity.y = -body.velocity.y * restitution;
      body.velocity.x *= frictionFactor;
    }
    collisions.push({
      aId: body.id,
      bId: "__world__",
      normal: { x: 0, y: 1 },
      depth,
      relativeSpeed: Math.abs(body.velocity.y),
    });
  }

  if (bottom > world.bounds.max.y) {
    const depth = bottom - world.bounds.max.y;
    body.position.y -= depth;
    if (body.velocity.y > 0) {
      body.velocity.y = -body.velocity.y * restitution;
      body.velocity.x *= frictionFactor;
    }
    collisions.push({
      aId: body.id,
      bId: "__world__",
      normal: { x: 0, y: -1 },
      depth,
      relativeSpeed: Math.abs(body.velocity.y),
    });
  }
}

function resolveBodyCollision(
  world: PhysicsWorldState,
  bodyA: PhysicsBody,
  bodyB: PhysicsBody,
  collisions: CollisionEvent[],
): void {
  const delta = subtract(bodyB.position, bodyA.position);
  const overlapX = bodyA.halfSize.x + bodyB.halfSize.x - Math.abs(delta.x);
  const overlapY = bodyA.halfSize.y + bodyB.halfSize.y - Math.abs(delta.y);

  if (overlapX <= 0 || overlapY <= 0) {
    return;
  }

  const normal: Vector2 =
    overlapX < overlapY
      ? { x: delta.x >= 0 ? 1 : -1, y: 0 }
      : { x: 0, y: delta.y >= 0 ? 1 : -1 };
  const depth = overlapX < overlapY ? overlapX : overlapY;

  const inverseMassA = bodyInverseMass(bodyA);
  const inverseMassB = bodyInverseMass(bodyB);
  const inverseMassTotal = inverseMassA + inverseMassB;

  if (inverseMassTotal <= Number.EPSILON) {
    return;
  }

  const separation = scale(normal, depth);

  if (inverseMassA > 0) {
    bodyA.position.x -= separation.x * (inverseMassA / inverseMassTotal);
    bodyA.position.y -= separation.y * (inverseMassA / inverseMassTotal);
  }

  if (inverseMassB > 0) {
    bodyB.position.x += separation.x * (inverseMassB / inverseMassTotal);
    bodyB.position.y += separation.y * (inverseMassB / inverseMassTotal);
  }

  const relativeVelocity = subtract(bodyB.velocity, bodyA.velocity);
  const velocityAlongNormal = dot(relativeVelocity, normal);

  if (velocityAlongNormal > 0) {
    return;
  }

  const restitution = Math.min(
    getBodyRestitution(world, bodyA),
    getBodyRestitution(world, bodyB),
  );
  const normalImpulseScalar =
    (-(1 + restitution) * velocityAlongNormal) / inverseMassTotal;
  const normalImpulse = scale(normal, normalImpulseScalar);

  if (inverseMassA > 0) {
    bodyA.velocity.x -= normalImpulse.x * inverseMassA;
    bodyA.velocity.y -= normalImpulse.y * inverseMassA;
  }

  if (inverseMassB > 0) {
    bodyB.velocity.x += normalImpulse.x * inverseMassB;
    bodyB.velocity.y += normalImpulse.y * inverseMassB;
  }

  const tangentVector = subtract(
    relativeVelocity,
    scale(normal, dot(relativeVelocity, normal)),
  );
  const tangent = normalize(tangentVector);
  const friction = Math.sqrt(
    getBodyFriction(world, bodyA) * getBodyFriction(world, bodyB),
  );
  const tangentImpulseUnclamped =
    -dot(relativeVelocity, tangent) / inverseMassTotal;
  const tangentImpulseLimit = normalImpulseScalar * friction;
  const tangentImpulseScalar = clamp(
    tangentImpulseUnclamped,
    -tangentImpulseLimit,
    tangentImpulseLimit,
  );
  const tangentImpulse = scale(tangent, tangentImpulseScalar);

  if (inverseMassA > 0) {
    bodyA.velocity.x -= tangentImpulse.x * inverseMassA;
    bodyA.velocity.y -= tangentImpulse.y * inverseMassA;
  }

  if (inverseMassB > 0) {
    bodyB.velocity.x += tangentImpulse.x * inverseMassB;
    bodyB.velocity.y += tangentImpulse.y * inverseMassB;
  }

  collisions.push({
    aId: bodyA.id,
    bId: bodyB.id,
    normal,
    depth,
    relativeSpeed: Math.abs(velocityAlongNormal),
  });
}

function integrateBodies(world: PhysicsWorldState, dtSeconds: number): void {
  for (const body of world.bodies) {
    if (!isDynamic(body)) {
      continue;
    }

    body.velocity.x += world.gravity.x * dtSeconds;
    body.velocity.y += world.gravity.y * dtSeconds;

    const damping = getBodyLinearDamping(world, body);
    const dampingFactor = clamp(1 - damping * dtSeconds, 0, 1);
    body.velocity.x *= dampingFactor;
    body.velocity.y *= dampingFactor;

    body.position.x += body.velocity.x * dtSeconds;
    body.position.y += body.velocity.y * dtSeconds;
  }
}

function stepWorld(
  sourceWorld: PhysicsWorldState,
  actions: PhysicsAction[],
  dtMs: number,
): { world: PhysicsWorldState; collisions: CollisionEvent[] } {
  const world = cloneWorld(sourceWorld);
  const dtSeconds = dtMs / 1000;
  const collisions: CollisionEvent[] = [];
  const bodyById = new Map(world.bodies.map((body) => [body.id, body]));

  for (const action of actions) {
    applyAction(world, bodyById, action, dtSeconds);
  }

  integrateBodies(world, dtSeconds);

  for (const body of world.bodies) {
    resolveWorldCollision(world, body, collisions);
  }

  const orderedBodies = [...world.bodies].sort((a, b) => a.id.localeCompare(b.id));
  for (let index = 0; index < orderedBodies.length; index += 1) {
    const bodyA = orderedBodies[index];
    for (let inner = index + 1; inner < orderedBodies.length; inner += 1) {
      const bodyB = orderedBodies[inner];
      if (!isDynamic(bodyA) && !isDynamic(bodyB)) {
        continue;
      }
      resolveBodyCollision(world, bodyA, bodyB, collisions);
    }
  }

  world.tick += 1;
  world.elapsedMs += dtMs;
  return { world, collisions };
}

export function runPhysicsSimulation(
  request: PhysicsSimulationRequest,
): PhysicsSimulationResult {
  const dtMs = clamp(request.dtMs ?? DEFAULT_DT_MS, MIN_DT_MS, MAX_DT_MS);
  const steps = Math.round(
    clamp(request.steps ?? DEFAULT_STEPS, DEFAULT_STEPS, MAX_STEPS),
  );
  const actions = request.actions ?? [];

  let world = cloneWorld(request.world);
  const collisions: CollisionEvent[] = [];

  for (let stepIndex = 0; stepIndex < steps; stepIndex += 1) {
    const stepActions = stepIndex === 0 ? actions : [];
    const result = stepWorld(world, stepActions, dtMs);
    world = result.world;
    collisions.push(...result.collisions);
  }

  return { world, collisions };
}
