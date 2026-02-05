"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  runPhysicsSimulation,
  type PhysicsAction,
  type PhysicsBody,
  type PhysicsWorldState,
} from "@/lib/game-physics";
import {
  getDefaultGameConfig,
  mergeGameConfig,
  type DemoMode,
  type EquationAnnotation,
  type GameConfig,
} from "@/lib/workflow/game-config";

type BodyStyle = {
  color: string;
  label?: string;
  shape: "circle" | "square";
  isGround?: boolean;
};

type SceneDefinition = {
  world: PhysicsWorldState;
  styles: Map<string, BodyStyle>;
  floorTop: number | null;
  comparisonPair?: [string, string];
  focusId?: string;
};

type SpawnRequest = {
  size: number;
  mass: number;
  color: string;
};

type StoredConceptGame = {
  conceptNode?: {
    id?: string;
    title?: string;
    objective?: string;
  };
  config?: Partial<GameConfig>;
  issues?: string[];
};

type LoadedConceptGame = {
  id: string;
  title: string;
  objective: string;
  config: GameConfig;
  issues: string[];
};

const AXIS_COLOR = "#3a3530";
const GRID_MAJOR = 64;
const STORAGE_CONFIG = "age.gameConfig";
const STORAGE_CONFIGS = "age.gameConfigs";

function createRandom(seed: number): () => number {
  let value = Math.max(1, Math.abs(Math.floor(seed)) % 2147483647);
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

function parseStoredConceptGames(raw: unknown): LoadedConceptGame[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((entry, index): LoadedConceptGame | null => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const candidate = entry as StoredConceptGame;
      const config = mergeGameConfig(candidate.config ?? {});
      const title =
        candidate.conceptNode?.title?.trim() || config.title || `Concept ${index + 1}`;
      const objective =
        candidate.conceptNode?.objective?.trim() || config.concept || "Interactive concept game";
      const id = candidate.conceptNode?.id?.trim() || `concept-${index + 1}`;
      const issues = Array.isArray(candidate.issues)
        ? candidate.issues.filter((issue): issue is string => typeof issue === "string")
        : [];

      return {
        id,
        title,
        objective,
        config,
        issues,
      };
    })
    .filter((entry): entry is LoadedConceptGame => Boolean(entry));
}

function createGamesFromStorage(): LoadedConceptGame[] {
  const fallbackConfig = getDefaultGameConfig();

  if (typeof window === "undefined") {
    return [
      {
        id: "default-1",
        title: fallbackConfig.title,
        objective: fallbackConfig.concept,
        config: fallbackConfig,
        issues: [],
      },
    ];
  }

  const storedList = window.localStorage.getItem(STORAGE_CONFIGS);
  if (storedList) {
    try {
      const parsed = JSON.parse(storedList) as unknown;
      const conceptGames = parseStoredConceptGames(parsed);
      if (conceptGames.length > 0) {
        return conceptGames;
      }
    } catch {
      // Ignore malformed local storage payloads.
    }
  }

  const single = window.localStorage.getItem(STORAGE_CONFIG);
  if (single) {
    try {
      const parsed = JSON.parse(single) as Partial<GameConfig>;
      const config = mergeGameConfig(parsed);
      return [
        {
          id: "default-1",
          title: config.title,
          objective: config.concept,
          config,
          issues: [],
        },
      ];
    } catch {
      return [
        {
          id: "default-1",
          title: fallbackConfig.title,
          objective: fallbackConfig.concept,
          config: fallbackConfig,
          issues: [],
        },
      ];
    }
  }

  return [
    {
      id: "default-1",
      title: fallbackConfig.title,
      objective: fallbackConfig.concept,
      config: fallbackConfig,
      issues: [],
    },
  ];
}

function bodyStyle(color: string, label?: string, shape: "circle" | "square" = "circle"): BodyStyle {
  return {
    color,
    label,
    shape,
  };
}

function createGravityScene(
  config: GameConfig,
  gravity: number,
  restitution: number,
): SceneDefinition {
  const floorY = config.arena.height - 56;
  const floorHalfHeight = 14;
  const floorTop = floorY - floorHalfHeight;

  const lightId = "gravity-light";
  const heavyId = "gravity-heavy";

  const world: PhysicsWorldState = {
    tick: 0,
    elapsedMs: 0,
    gravity: { x: 0, y: gravity },
    bounds: {
      min: { x: 0, y: 0 },
      max: { x: config.arena.width, y: config.arena.height },
    },
    defaultRestitution: restitution,
    defaultFriction: 0.02,
    defaultLinearDamping: 0.015,
    bodies: [
      {
        id: "ground",
        position: {
          x: config.arena.width / 2,
          y: floorY,
        },
        velocity: { x: 0, y: 0 },
        halfSize: {
          x: config.arena.width * 0.44,
          y: floorHalfHeight,
        },
        mass: 1,
        isStatic: true,
      },
      {
        id: lightId,
        position: {
          x: config.arena.width * 0.38,
          y: config.demonstration.spawnHeight,
        },
        velocity: { x: 0, y: 0 },
        halfSize: { x: 14, y: 14 },
        mass: 1,
        restitution,
      },
      {
        id: heavyId,
        position: {
          x: config.arena.width * 0.62,
          y: config.demonstration.spawnHeight,
        },
        velocity: { x: 0, y: 0 },
        halfSize: { x: 30, y: 30 },
        mass: 12,
        restitution,
      },
    ],
  };

  return {
    world,
    floorTop,
    comparisonPair: [lightId, heavyId],
    focusId: lightId,
    styles: new Map<string, BodyStyle>([
      ["ground", { color: "#5f5546", shape: "square", isGround: true, label: "Ground" }],
      [lightId, bodyStyle("#2f58c9", "Light ball")],
      [heavyId, bodyStyle("#c23d3d", "Heavy ball")],
    ]),
  };
}

function createCollisionScene(
  config: GameConfig,
  gravity: number,
  restitution: number,
): SceneDefinition {
  const leftId = "collision-left";
  const rightId = "collision-right";

  const world: PhysicsWorldState = {
    tick: 0,
    elapsedMs: 0,
    gravity: { x: 0, y: gravity },
    bounds: {
      min: { x: 0, y: 0 },
      max: { x: config.arena.width, y: config.arena.height },
    },
    defaultRestitution: restitution,
    defaultFriction: 0.02,
    defaultLinearDamping: 0.005,
    bodies: [
      {
        id: leftId,
        position: { x: config.arena.width * 0.22, y: config.arena.height * 0.5 },
        velocity: { x: 180, y: 0 },
        halfSize: { x: 18, y: 18 },
        mass: 1,
        restitution,
      },
      {
        id: rightId,
        position: { x: config.arena.width * 0.78, y: config.arena.height * 0.5 },
        velocity: { x: -130, y: 0 },
        halfSize: { x: 26, y: 26 },
        mass: 3,
        restitution,
      },
    ],
  };

  return {
    world,
    floorTop: null,
    comparisonPair: [leftId, rightId],
    focusId: leftId,
    styles: new Map<string, BodyStyle>([
      [leftId, bodyStyle("#1c8b6d", "Mass 1")],
      [rightId, bodyStyle("#ba5f21", "Mass 3")],
    ]),
  };
}

function createProjectileScene(
  config: GameConfig,
  gravity: number,
  restitution: number,
): SceneDefinition {
  const projectileId = "projectile";
  const floorY = config.arena.height - 56;
  const floorHalfHeight = 14;
  const floorTop = floorY - floorHalfHeight;

  const world: PhysicsWorldState = {
    tick: 0,
    elapsedMs: 0,
    gravity: { x: 0, y: gravity },
    bounds: {
      min: { x: 0, y: 0 },
      max: { x: config.arena.width, y: config.arena.height },
    },
    defaultRestitution: restitution,
    defaultFriction: 0.03,
    defaultLinearDamping: 0.01,
    bodies: [
      {
        id: "ground",
        position: {
          x: config.arena.width / 2,
          y: floorY,
        },
        velocity: { x: 0, y: 0 },
        halfSize: {
          x: config.arena.width * 0.44,
          y: floorHalfHeight,
        },
        mass: 1,
        isStatic: true,
      },
      {
        id: projectileId,
        position: { x: 130, y: config.arena.height - 126 },
        velocity: { x: 180, y: -250 },
        halfSize: { x: 14, y: 14 },
        mass: 1,
        restitution,
      },
    ],
  };

  return {
    world,
    floorTop,
    focusId: projectileId,
    styles: new Map<string, BodyStyle>([
      ["ground", { color: "#5f5546", shape: "square", isGround: true, label: "Ground" }],
      [projectileId, bodyStyle("#2f58c9", "Projectile")],
    ]),
  };
}

function createScene(config: GameConfig, gravity: number, restitution: number): SceneDefinition {
  if (config.demonstration.mode === "collision") {
    return createCollisionScene(config, gravity, restitution);
  }

  if (config.demonstration.mode === "projectile") {
    return createProjectileScene(config, gravity, restitution);
  }

  return createGravityScene(config, gravity, restitution);
}

function drawGrid(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  color: string,
): void {
  context.strokeStyle = color;
  context.lineWidth = 1;

  for (let x = 0; x <= width; x += GRID_MAJOR) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, height);
    context.stroke();
  }

  for (let y = 0; y <= height; y += GRID_MAJOR) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y);
    context.stroke();
  }
}

function drawBody(
  context: CanvasRenderingContext2D,
  body: PhysicsBody,
  style: BodyStyle,
  showVelocityHints: boolean,
  accent: string,
): void {
  context.fillStyle = style.color;

  if (style.shape === "square") {
    context.fillRect(
      body.position.x - body.halfSize.x,
      body.position.y - body.halfSize.y,
      body.halfSize.x * 2,
      body.halfSize.y * 2,
    );
  } else {
    context.beginPath();
    context.arc(
      body.position.x,
      body.position.y,
      Math.min(body.halfSize.x, body.halfSize.y),
      0,
      Math.PI * 2,
    );
    context.fill();
  }

  if (showVelocityHints) {
    context.strokeStyle = accent;
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(body.position.x, body.position.y);
    context.lineTo(
      body.position.x + body.velocity.x * 0.11,
      body.position.y + body.velocity.y * 0.11,
    );
    context.stroke();
  }

  if (style.label) {
    context.fillStyle = AXIS_COLOR;
    context.font = '12px "Instrument Sans", sans-serif';
    context.fillText(
      style.label,
      body.position.x - body.halfSize.x,
      body.position.y - body.halfSize.y - 8,
    );
  }
}

function modeTitle(mode: DemoMode): string {
  if (mode === "collision") {
    return "Collision Demonstration";
  }

  if (mode === "projectile") {
    return "Projectile Demonstration";
  }

  return "Gravity Demonstration";
}

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const spawnRequestsRef = useRef<SpawnRequest[]>([]);
  const pausedRef = useRef(false);
  const gravityRef = useRef(26);
  const restitutionRef = useRef(0.28);

  const [games] = useState<LoadedConceptGame[]>(createGamesFromStorage);
  const [activeGameIndex, setActiveGameIndex] = useState(0);
  const activeGame =
    games[activeGameIndex] ??
    games[0] ?? {
      id: "fallback-1",
      title: "Generated Physics Demo",
      objective: "Interactive concept game",
      config: getDefaultGameConfig(),
      issues: [],
    };
  const config = activeGame.config;

  const [isPaused, setIsPaused] = useState(false);
  const [gravityStrength, setGravityStrength] = useState(config.demonstration.gravity);
  const [restitution, setRestitution] = useState(config.demonstration.baseRestitution);
  const [spawnSize, setSpawnSize] = useState(18);
  const [spawnMass, setSpawnMass] = useState(1);
  const [spawnColor, setSpawnColor] = useState(config.visualization.accent);
  const [landingDeltaSeconds, setLandingDeltaSeconds] = useState<number | null>(null);
  const [spawnedObjects, setSpawnedObjects] = useState(0);
  const [sceneSeed, setSceneSeed] = useState(0);
  const [tutorModeEnabled, setTutorModeEnabled] = useState(true);
  const [selectedEquationId, setSelectedEquationId] = useState<string>(
    config.learning.equationAnnotations[0]?.id ?? "",
  );
  const [checkpointState, setCheckpointState] = useState<Record<string, boolean>>({});

  useEffect(() => {
    pausedRef.current = isPaused;
  }, [isPaused]);

  useEffect(() => {
    gravityRef.current = gravityStrength;
  }, [gravityStrength]);

  useEffect(() => {
    restitutionRef.current = restitution;
  }, [restitution]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) {
      return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    const random = createRandom(config.title.length + sceneSeed * 37 + 17);
    const scene = createScene(config, gravityRef.current, restitutionRef.current);
    let world = scene.world;
    const styles = scene.styles;
    const landingTimes = new Map<string, number>();
    let landingReported = false;
    let animationId = 0;
    let lastTime = performance.now();
    let trails: Array<{ x: number; y: number; age: number }> = [];
    let nextSpawnId = 0;

    const resize = () => {
      const width = Math.min(config.arena.width, container.clientWidth);
      const height = (width / config.arena.width) * config.arena.height;
      canvas.width = width * window.devicePixelRatio;
      canvas.height = height * window.devicePixelRatio;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
    };

    const makeSpawnBody = (request: SpawnRequest): PhysicsBody => {
      const bodyId = `extra-${nextSpawnId}`;
      nextSpawnId += 1;

      const baseX = config.arena.width * (0.25 + random() * 0.5);
      const spawnY = config.demonstration.spawnHeight;

      let velocity = { x: 0, y: 0 };
      if (config.demonstration.mode === "collision") {
        velocity = {
          x: (random() > 0.5 ? 1 : -1) * (80 + random() * 110),
          y: 0,
        };
      }

      if (config.demonstration.mode === "projectile") {
        velocity = {
          x: 120 + random() * 90,
          y: -(130 + random() * 170),
        };
      }

      styles.set(bodyId, bodyStyle(request.color, `Object ${nextSpawnId}`));

      return {
        id: bodyId,
        position: {
          x: baseX,
          y: spawnY,
        },
        velocity,
        halfSize: { x: request.size, y: request.size },
        mass: request.mass,
        restitution: restitutionRef.current,
      };
    };

    resize();
    window.addEventListener("resize", resize);

    const render = () => {
      context.clearRect(0, 0, config.arena.width, config.arena.height);
      context.fillStyle = config.arena.background;
      context.fillRect(0, 0, config.arena.width, config.arena.height);

      if (config.visualization.showGrid) {
        drawGrid(context, config.arena.width, config.arena.height, config.arena.gridColor);
      }

      if (config.visualization.showTrails) {
        for (const trail of trails) {
          context.fillStyle = `rgba(43, 111, 106, ${Math.max(0, 0.2 - trail.age * 0.2)})`;
          context.beginPath();
          context.arc(trail.x, trail.y, 8, 0, Math.PI * 2);
          context.fill();
        }
      }

      for (const body of world.bodies) {
        const style = styles.get(body.id) ?? bodyStyle(config.visualization.accent);
        drawBody(
          context,
          body,
          style,
          config.visualization.showVelocityHints,
          config.visualization.accent,
        );
      }

      context.fillStyle = AXIS_COLOR;
      context.font = '13px "Instrument Sans", sans-serif';
      context.fillText(
        `Tick: ${world.tick}  |  Elapsed: ${(world.elapsedMs / 1000).toFixed(2)}s`,
        16,
        22,
      );
    };

    const update = (deltaSeconds: number) => {
      if (pausedRef.current) {
        return;
      }

      world.gravity.y = gravityRef.current;
      for (const body of world.bodies) {
        if (!body.isStatic) {
          body.restitution = restitutionRef.current;
        }
      }

      const actions: PhysicsAction[] = [];

      while (spawnRequestsRef.current.length > 0) {
        const request = spawnRequestsRef.current.shift();
        if (!request) {
          break;
        }
        actions.push({
          type: "spawnBody",
          body: makeSpawnBody(request),
        });
      }

      const result = runPhysicsSimulation({
        world,
        actions,
        dtMs: Math.max(1, deltaSeconds * 1000),
        steps: 1,
      });
      world = result.world;

      if (scene.focusId && config.visualization.showTrails) {
        const focusBody = world.bodies.find((body) => body.id === scene.focusId);
        if (focusBody) {
          trails.unshift({
            x: focusBody.position.x,
            y: focusBody.position.y,
            age: 0,
          });
        }
      }

      trails = trails
        .map((trail) => ({ ...trail, age: trail.age + deltaSeconds }))
        .filter((trail) => trail.age < 0.9)
        .slice(0, 120);

      if (
        config.demonstration.mode === "gravity" &&
        scene.comparisonPair &&
        scene.floorTop !== null
      ) {
        const [leftId, rightId] = scene.comparisonPair;
        const leftBody = world.bodies.find((body) => body.id === leftId);
        const rightBody = world.bodies.find((body) => body.id === rightId);

        if (
          leftBody &&
          !landingTimes.has(leftId) &&
          leftBody.position.y + leftBody.halfSize.y >= scene.floorTop
        ) {
          landingTimes.set(leftId, world.elapsedMs / 1000);
        }

        if (
          rightBody &&
          !landingTimes.has(rightId) &&
          rightBody.position.y + rightBody.halfSize.y >= scene.floorTop
        ) {
          landingTimes.set(rightId, world.elapsedMs / 1000);
        }

        if (
          !landingReported &&
          landingTimes.has(leftId) &&
          landingTimes.has(rightId)
        ) {
          const delta = Math.abs(
            (landingTimes.get(leftId) ?? 0) - (landingTimes.get(rightId) ?? 0),
          );
          landingReported = true;
          setLandingDeltaSeconds(delta);
        }
      }
    };

    const loop = (time: number) => {
      const deltaSeconds = Math.min(0.04, (time - lastTime) / 1000);
      lastTime = time;
      update(deltaSeconds);
      render();
      animationId = requestAnimationFrame(loop);
    };

    animationId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
    };
  }, [config, sceneSeed]);

  const title = useMemo(() => modeTitle(config.demonstration.mode), [config.demonstration.mode]);
  const statusLabel = useMemo(() => {
    if (isPaused) {
      return "Paused";
    }

    if (config.demonstration.mode === "gravity" && landingDeltaSeconds !== null) {
      return `Landing delta: ${landingDeltaSeconds.toFixed(3)}s`;
    }

    return "Running";
  }, [isPaused, config.demonstration.mode, landingDeltaSeconds]);

  const selectedEquation: EquationAnnotation | null = useMemo(() => {
    const annotations = config.learning.equationAnnotations;
    if (annotations.length === 0) {
      return null;
    }

    return (
      annotations.find((annotation) => annotation.id === selectedEquationId) ??
      annotations[0]
    );
  }, [config.learning.equationAnnotations, selectedEquationId]);

  const completedCheckpoints = useMemo(() => {
    const checkpointKeys = config.learning.checkpoints;
    return checkpointKeys.filter((checkpoint) => checkpointState[checkpoint]).length;
  }, [checkpointState, config.learning.checkpoints]);

  const handleAddObject = () => {
    spawnRequestsRef.current.push({
      size: spawnSize,
      mass: spawnMass,
      color: spawnColor,
    });
    setSpawnedObjects((count) => count + 1);
  };

  const handleReset = () => {
    setLandingDeltaSeconds(null);
    setSpawnedObjects(0);
    spawnRequestsRef.current = [];
    setSceneSeed((seed) => seed + 1);
  };

  const activateGame = (index: number) => {
    const nextGame = games[index];
    if (!nextGame) {
      return;
    }

    setActiveGameIndex(index);
    setIsPaused(false);
    setGravityStrength(nextGame.config.demonstration.gravity);
    setRestitution(nextGame.config.demonstration.baseRestitution);
    setSpawnColor(nextGame.config.visualization.accent);
    setLandingDeltaSeconds(null);
    setSpawnedObjects(0);
    setSelectedEquationId(nextGame.config.learning.equationAnnotations[0]?.id ?? "");
    setCheckpointState({});
    spawnRequestsRef.current = [];
    setSceneSeed((seed) => seed + 1);
  };

  return (
    <div className="gameShell" ref={containerRef}>
      <div className="gameHeader">
        <div>
          <p className="eyebrow">Physics Concept Canvas</p>
          <h1 className="gameTitle">{activeGame.title}</h1>
          <p className="lede">{activeGame.objective}</p>
        </div>
        <div className={`statusBadge ${landingDeltaSeconds !== null ? "win" : ""}`}>
          {statusLabel}
        </div>
      </div>

      {games.length > 1 ? (
        <div className="conceptTabs">
          {games.map((game, index) => (
            <button
              key={game.id}
              type="button"
              className={`conceptTab ${index === activeGameIndex ? "active" : ""}`}
              onClick={() => activateGame(index)}
            >
              <span>{index + 1}.</span> {game.title}
            </button>
          ))}
        </div>
      ) : null}

      <div className="conceptLayout">
        <div className="conceptStage">
          <div className="gameCanvasWrap">
            <canvas ref={canvasRef} className="gameCanvas" />
          </div>
          <div className="gameFooter">
            <p>{config.demonstration.summary}</p>
            <p>{title}</p>
          </div>
        </div>

        <aside className="conceptSidebar">
          <div className="conceptPanel">
            <h2>Interactive Controls</h2>
            <p>{config.learning.coachPrompt}</p>
          </div>

          <div className="controlGroup">
            <label htmlFor="gravity-strength">Gravity</label>
            <input
              id="gravity-strength"
              type="range"
              min={0}
              max={60}
              step={1}
              value={gravityStrength}
              onChange={(event) => setGravityStrength(Number(event.target.value))}
            />
            <span>{gravityStrength.toFixed(0)}</span>
          </div>

          <div className="controlGroup">
            <label htmlFor="restitution">Bounciness</label>
            <input
              id="restitution"
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={restitution}
              onChange={(event) => setRestitution(Number(event.target.value))}
            />
            <span>{restitution.toFixed(2)}</span>
          </div>

          <div className="controlGroup">
            <label htmlFor="spawn-size">New Object Size</label>
            <input
              id="spawn-size"
              type="range"
              min={8}
              max={40}
              step={1}
              value={spawnSize}
              onChange={(event) => setSpawnSize(Number(event.target.value))}
            />
            <span>{spawnSize}px</span>
          </div>

          <div className="controlGroup">
            <label htmlFor="spawn-mass">New Object Mass</label>
            <input
              id="spawn-mass"
              type="range"
              min={0.5}
              max={12}
              step={0.5}
              value={spawnMass}
              onChange={(event) => setSpawnMass(Number(event.target.value))}
            />
            <span>{spawnMass.toFixed(1)}</span>
          </div>

          <div className="controlGroup">
            <label htmlFor="spawn-color">New Object Color</label>
            <input
              id="spawn-color"
              type="color"
              value={spawnColor}
              onChange={(event) => setSpawnColor(event.target.value)}
            />
          </div>

          <div className="sidebarButtons">
            <button className="primaryButton" type="button" onClick={handleAddObject}>
              Add Object
            </button>
            <button
              className="ghostButton"
              type="button"
              onClick={() => setIsPaused((paused) => !paused)}
            >
              {isPaused ? "Resume" : "Pause"}
            </button>
            <button className="ghostButton" type="button" onClick={handleReset}>
              Reset Scene
            </button>
          </div>

          <div className="conceptPanel">
            <h2>{config.learning.sidebarTitle}</h2>
            <button
              className="ghostButton"
              type="button"
              onClick={() => setTutorModeEnabled((enabled) => !enabled)}
            >
              {tutorModeEnabled ? "Hide Tutor Mode" : "Show Tutor Mode"}
            </button>
            {tutorModeEnabled ? (
              <>
                <ul className="lessonList">
                  {config.learning.tutorTips.map((tip) => (
                    <li key={tip}>{tip}</li>
                  ))}
                </ul>
                <div className="checkpointGroup">
                  <p className="metaTitle">
                    Checkpoints ({completedCheckpoints}/{config.learning.checkpoints.length})
                  </p>
                  {config.learning.checkpoints.map((checkpoint) => (
                    <label key={checkpoint} className="checkpointRow">
                      <input
                        type="checkbox"
                        checked={Boolean(checkpointState[checkpoint])}
                        onChange={() =>
                          setCheckpointState((state) => ({
                            ...state,
                            [checkpoint]: !state[checkpoint],
                          }))
                        }
                      />
                      <span>{checkpoint}</span>
                    </label>
                  ))}
                </div>
              </>
            ) : null}
          </div>

          <div className="conceptPanel equationPanel">
            <h2>Equation Annotations</h2>
            <div className="equationChooser">
              {config.learning.equationAnnotations.map((annotation) => (
                <button
                  key={annotation.id}
                  type="button"
                  className={`equationPill ${selectedEquation?.id === annotation.id ? "active" : ""}`}
                  onClick={() => setSelectedEquationId(annotation.id)}
                >
                  {annotation.label}
                </button>
              ))}
            </div>
            {selectedEquation ? (
              <div className="equationCard">
                <p className="equationLabel">{selectedEquation.label}</p>
                <p className="equationFormula">{selectedEquation.equation}</p>
                <p className="equationExplanation">{selectedEquation.explanation}</p>
                <ul className="variableList">
                  {selectedEquation.variables.map((variable) => (
                    <li key={variable}>{variable}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="logEmpty">No equation annotations available.</p>
            )}
          </div>

          <div className="conceptPanel">
            <p>
              Spawned objects: <strong>{spawnedObjects}</strong>
            </p>
            {config.demonstration.mode === "gravity" ? (
              <p>
                Heavy vs light landing delta:{" "}
                <strong>
                  {landingDeltaSeconds === null
                    ? "waiting..."
                    : `${landingDeltaSeconds.toFixed(3)}s`}
                </strong>
              </p>
            ) : null}
            {activeGame.issues.length > 0 ? (
              <>
                <p className="metaTitle">Agent Notes</p>
                <ul className="lessonList">
                  {activeGame.issues.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              </>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}
