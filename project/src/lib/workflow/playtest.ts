import { runPhysicsSimulation } from "@/lib/game-physics";
import type { PhysicsAction, PhysicsWorldState } from "@/lib/game-physics";
import { mergeGameConfig, type GameConfig } from "@/lib/workflow/game-config";

const PLAYER_ID = "player";
const OBSTACLE_PREFIX = "obstacle-";

export type PlaytestMetrics = {
  collisions: number;
  firstCollisionSecond: number | null;
  completedSeconds: number;
  obstacleResets: number;
  conceptMode?: string;
  landingDeltaSeconds?: number | null;
};

export type PlaytestEvaluation = {
  issues: string[];
  metrics: PlaytestMetrics;
};

function createRandom(seed: number): () => number {
  let value = Math.max(1, Math.abs(Math.floor(seed)) % 2147483647);
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

function createWorld(config: GameConfig, random: () => number): PhysicsWorldState {
  const playerSpawnX = config.arena.width / 2;
  const playerSpawnY = config.arena.height - 72;
  const spacing = config.arena.width / Math.max(1, config.obstacles.count);

  return {
    tick: 0,
    elapsedMs: 0,
    gravity: { x: 0, y: 0 },
    bounds: {
      min: { x: 0, y: 0 },
      max: { x: config.arena.width, y: config.arena.height },
    },
    defaultRestitution: 0.18,
    defaultFriction: 0.05,
    defaultLinearDamping: 0.03,
    bodies: [
      {
        id: PLAYER_ID,
        position: { x: playerSpawnX, y: playerSpawnY },
        velocity: { x: 0, y: 0 },
        halfSize: { x: config.player.radius, y: config.player.radius },
        mass: 1,
      },
      ...Array.from({ length: config.obstacles.count }, (_, index) => {
        const spreadOffset = (random() - 0.5) * spacing * config.obstacles.spread;
        const x = spacing * (index + 0.5) + spreadOffset;
        return {
          id: `${OBSTACLE_PREFIX}${index}`,
          position: {
            x,
            y: -random() * config.arena.height,
          },
          velocity: {
            x: 0,
            y: config.obstacles.speed * (0.8 + random() * 0.5),
          },
          halfSize: {
            x: config.obstacles.radius,
            y: config.obstacles.radius,
          },
          mass: 1,
          restitution: 0.05,
          friction: 0.05,
        };
      }),
    ],
  };
}

function evaluateGravityConcept(config: GameConfig): PlaytestEvaluation {
  const floorHeight = 40;
  const floorThickness = 16;
  const floorTop = config.arena.height - floorHeight - floorThickness;
  const leftId = "gravity-light";
  const rightId = "gravity-heavy";
  const dtMs = 1000 / 60;
  const maxSteps = 60 * 15;

  let world: PhysicsWorldState = {
    tick: 0,
    elapsedMs: 0,
    gravity: { x: 0, y: config.demonstration.gravity },
    bounds: {
      min: { x: 0, y: 0 },
      max: { x: config.arena.width, y: config.arena.height },
    },
    defaultRestitution: config.demonstration.baseRestitution,
    defaultFriction: 0.02,
    defaultLinearDamping: 0.01,
    bodies: [
      {
        id: "ground",
        position: {
          x: config.arena.width / 2,
          y: floorTop + floorThickness,
        },
        velocity: { x: 0, y: 0 },
        halfSize: {
          x: config.arena.width * 0.45,
          y: floorThickness,
        },
        mass: 1000,
        isStatic: true,
      },
      {
        id: leftId,
        position: {
          x: config.arena.width * 0.4,
          y: config.demonstration.spawnHeight,
        },
        velocity: { x: 0, y: 0 },
        halfSize: { x: 14, y: 14 },
        mass: 1,
        restitution: config.demonstration.baseRestitution,
      },
      {
        id: rightId,
        position: {
          x: config.arena.width * 0.6,
          y: config.demonstration.spawnHeight,
        },
        velocity: { x: 0, y: 0 },
        halfSize: { x: 28, y: 28 },
        mass: 9,
        restitution: config.demonstration.baseRestitution,
      },
    ],
  };

  let leftLanding: number | null = null;
  let rightLanding: number | null = null;

  for (let step = 0; step < maxSteps; step += 1) {
    const result = runPhysicsSimulation({
      world,
      dtMs,
      steps: 1,
    });
    world = result.world;

    const left = world.bodies.find((body) => body.id === leftId);
    const right = world.bodies.find((body) => body.id === rightId);

    if (left && leftLanding === null && left.position.y + left.halfSize.y >= floorTop - 1) {
      leftLanding = world.elapsedMs / 1000;
    }

    if (right && rightLanding === null && right.position.y + right.halfSize.y >= floorTop - 1) {
      rightLanding = world.elapsedMs / 1000;
    }

    if (leftLanding !== null && rightLanding !== null) {
      break;
    }
  }

  const landingDeltaSeconds =
    leftLanding !== null && rightLanding !== null
      ? Math.abs(leftLanding - rightLanding)
      : null;

  const issues: string[] = [];
  if (leftLanding === null || rightLanding === null) {
    issues.push("Gravity demonstration did not complete in time.");
  } else if ((landingDeltaSeconds ?? 0) > 0.12) {
    issues.push("Objects of different mass are not landing close enough together.");
  }

  return {
    issues,
    metrics: {
      collisions: 0,
      firstCollisionSecond: null,
      completedSeconds: world.elapsedMs / 1000,
      obstacleResets: 0,
      conceptMode: "gravity",
      landingDeltaSeconds,
    },
  };
}

export function evaluateGameConfig(
  incomingConfig: GameConfig,
  simulationSeconds = 30,
): PlaytestEvaluation {
  const config = mergeGameConfig(incomingConfig);

  if (config.demonstration.mode === "gravity") {
    return evaluateGravityConcept(config);
  }

  const random = createRandom(config.title.length + config.obstacles.count * 17);
  const dtMs = 1000 / 30;
  const maxDurationMs = Math.min(simulationSeconds, config.rules.timer) * 1000;
  const centerX = config.arena.width / 2;

  let world = createWorld(config, random);
  let collisions = 0;
  let obstacleResets = 0;
  let firstCollisionSecond: number | null = null;
  let elapsedMs = 0;
  let invulnerabilityMs = 0;

  while (elapsedMs < maxDurationMs) {
    const player = world.bodies.find((body) => body.id === PLAYER_ID);
    if (!player) {
      break;
    }

    const threats = world.bodies.filter((body) => body.id.startsWith(OBSTACLE_PREFIX));
    let targetVelocityX = 0;

    const nearestThreat = threats
      .filter((body) => body.position.y <= player.position.y)
      .sort((a, b) => b.position.y - a.position.y)[0];

    if (nearestThreat) {
      const dx = nearestThreat.position.x - player.position.x;
      const dy = player.position.y - nearestThreat.position.y;
      if (Math.abs(dx) < config.player.radius * 3.2 && dy < 220) {
        targetVelocityX = dx >= 0 ? -config.player.speed : config.player.speed;
      }
    }

    if (targetVelocityX === 0) {
      const centerDelta = centerX - player.position.x;
      if (Math.abs(centerDelta) > config.player.radius * 1.2) {
        targetVelocityX = Math.sign(centerDelta) * config.player.speed * 0.35;
      }
    }

    const actions: PhysicsAction[] = [
      {
        type: "setVelocity",
        bodyId: PLAYER_ID,
        velocity: {
          x: targetVelocityX,
          y: 0,
        },
      },
    ];

    for (const obstacle of threats) {
      const bottom = obstacle.position.y - obstacle.halfSize.y;
      if (bottom <= config.arena.height + obstacle.halfSize.y) {
        continue;
      }

      obstacleResets += 1;
      actions.push({
        type: "teleport",
        bodyId: obstacle.id,
        position: {
          x: obstacle.halfSize.x + random() * (config.arena.width - obstacle.halfSize.x * 2),
          y: -(40 + random() * config.arena.height * 0.6),
        },
      });
      actions.push({
        type: "setVelocity",
        bodyId: obstacle.id,
        velocity: {
          x: 0,
          y: config.obstacles.speed * (0.8 + random() * 0.5),
        },
      });
    }

    const result = runPhysicsSimulation({
      world,
      actions,
      dtMs,
      steps: 1,
    });
    world = result.world;

    const playerCollision = result.collisions.some(
      (entry) =>
        (entry.aId === PLAYER_ID && entry.bId !== "__world__") ||
        (entry.bId === PLAYER_ID && entry.aId !== "__world__"),
    );

    if (invulnerabilityMs <= 0 && playerCollision) {
      collisions += 1;
      if (firstCollisionSecond === null) {
        firstCollisionSecond = elapsedMs / 1000;
      }
      invulnerabilityMs = 650;

      const livePlayer = world.bodies.find((body) => body.id === PLAYER_ID);
      if (livePlayer) {
        livePlayer.position = {
          x: centerX,
          y: config.arena.height - 72,
        };
        livePlayer.velocity = { x: 0, y: 0 };
      }
    }

    invulnerabilityMs = Math.max(0, invulnerabilityMs - dtMs);
    elapsedMs += dtMs;
  }

  const issues: string[] = [];
  if (collisions >= config.rules.lives * 3) {
    issues.push("Difficulty is too punishing for the allotted lives.");
  }
  if (firstCollisionSecond !== null && firstCollisionSecond < 3) {
    issues.push("Early collision spike detected in the first three seconds.");
  }
  if (collisions === 0 && elapsedMs >= Math.min(18000, maxDurationMs * 0.65)) {
    issues.push("Encounter pace is too easy and needs more pressure.");
  }

  return {
    issues,
    metrics: {
      collisions,
      firstCollisionSecond,
      completedSeconds: elapsedMs / 1000,
      obstacleResets,
    },
  };
}

export function applyIssueFixes(
  incomingConfig: GameConfig,
  issues: string[],
): GameConfig {
  const config = mergeGameConfig(incomingConfig);

  for (const issue of issues) {
    const normalized = issue.toLowerCase();

    if (
      config.demonstration.mode === "gravity" &&
      (normalized.includes("landing") || normalized.includes("gravity demonstration"))
    ) {
      config.demonstration.gravity = Math.max(10, config.demonstration.gravity);
      config.demonstration.baseRestitution = Math.min(
        0.18,
        config.demonstration.baseRestitution,
      );
      continue;
    }

    if (normalized.includes("punishing") || normalized.includes("spike")) {
      config.obstacles.speed *= 0.88;
      config.obstacles.count -= 1;
      config.player.speed *= 1.07;
      config.visualization.showVelocityHints = true;
      continue;
    }

    if (normalized.includes("easy") || normalized.includes("pressure")) {
      config.obstacles.speed *= 1.12;
      config.obstacles.count += 1;
      config.rules.timer += 8;
      config.visualization.showTrails = true;
    }
  }

  return mergeGameConfig(config);
}
