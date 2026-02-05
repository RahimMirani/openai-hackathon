export type DesignPlan = {
  title: string;
  concept: string;
  mechanics: string[];
  winCondition: string;
  failCondition: string;
  difficulty: number;
};

export type DemoMode = "gravity" | "collision" | "projectile";

export type EquationAnnotation = {
  id: string;
  label: string;
  equation: string;
  explanation: string;
  variables: string[];
};

export type LearningProfile = {
  sidebarTitle: string;
  coachPrompt: string;
  tutorTips: string[];
  checkpoints: string[];
  equationAnnotations: EquationAnnotation[];
};

export type GameConfig = {
  title: string;
  concept: string;
  goal: string;
  player: {
    speed: number;
    radius: number;
    color: string;
  };
  obstacles: {
    count: number;
    speed: number;
    radius: number;
    color: string;
    spread: number;
  };
  arena: {
    width: number;
    height: number;
    background: string;
    gridColor: string;
  };
  rules: {
    lives: number;
    timer: number;
  };
  visualization: {
    showGrid: boolean;
    showTrails: boolean;
    showVelocityHints: boolean;
    accent: string;
  };
  demonstration: {
    mode: DemoMode;
    summary: string;
    gravity: number;
    baseRestitution: number;
    spawnHeight: number;
  };
  learning: LearningProfile;
};

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends Array<infer U>
    ? U[]
    : T[K] extends object
      ? DeepPartial<T[K]>
      : T[K];
};

const HEX_COLOR_PATTERN = /^#(?:[0-9a-fA-F]{3}){1,2}$/;

const DEFAULT_PLAN: DesignPlan = {
  title: "Generated Physics Demo",
  concept: "Survive a flow of moving obstacles.",
  mechanics: ["movement", "dodging", "timer"],
  winCondition: "Survive until the timer ends.",
  failCondition: "Lose all lives.",
  difficulty: 5,
};

const DEFAULT_CONFIG: GameConfig = {
  title: "Generated Physics Demo",
  concept: "Dodge falling obstacles in a constrained arena.",
  goal: "Survive until the timer ends.",
  player: {
    speed: 240,
    radius: 14,
    color: "#1f5b57",
  },
  obstacles: {
    count: 7,
    speed: 130,
    radius: 12,
    color: "#b4552d",
    spread: 0.75,
  },
  arena: {
    width: 960,
    height: 540,
    background: "#fbfaf7",
    gridColor: "#e9e2d6",
  },
  rules: {
    lives: 3,
    timer: 70,
  },
  visualization: {
    showGrid: true,
    showTrails: true,
    showVelocityHints: false,
    accent: "#2b6f6a",
  },
  demonstration: {
    mode: "gravity",
    summary:
      "Objects with different masses accelerate equally in the same gravitational field.",
    gravity: 26,
    baseRestitution: 0.28,
    spawnHeight: 96,
  },
  learning: {
    sidebarTitle: "Learning Guide",
    coachPrompt: "Adjust controls and connect the observed behavior to the equations.",
    tutorTips: [
      "Run the simulation once before changing controls to establish a baseline.",
      "Change one parameter at a time and observe how trajectories differ.",
      "Use the velocity hints when you need clearer motion direction cues.",
    ],
    checkpoints: [
      "Predict what should happen before you press play.",
      "Check if the simulation matches the prediction.",
      "Explain the result using one equation annotation.",
    ],
    equationAnnotations: [
      {
        id: "gravity-force",
        label: "Newton's Second Law",
        equation: "F = m * a",
        explanation:
          "The same acceleration can appear for objects with different mass when force scales with mass.",
        variables: ["F: net force", "m: mass", "a: acceleration"],
      },
      {
        id: "gravity-motion",
        label: "Constant-Acceleration Position",
        equation: "y = y0 + v0*t + 0.5*g*t^2",
        explanation:
          "Vertical position evolves quadratically over time when gravity is approximately constant.",
        variables: ["y0: initial height", "v0: initial velocity", "g: gravity", "t: time"],
      },
    ],
  },
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function safeString(value: unknown, fallback: string): string {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim();
  return normalized ? normalized : fallback;
}

function safeBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  return fallback;
}

function safeNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

function safeColor(value: unknown, fallback: string): string {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim();
  if (!HEX_COLOR_PATTERN.test(normalized)) {
    return fallback;
  }

  return normalized;
}

function safeStringArray(
  value: unknown,
  fallback: string[],
  maxItems: number,
  maxLength: number,
): string[] {
  if (!Array.isArray(value)) {
    return [...fallback];
  }

  const normalized = value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => entry.slice(0, maxLength))
    .slice(0, maxItems);

  if (normalized.length === 0) {
    return [...fallback];
  }

  return normalized;
}

function normalizeEquationAnnotation(
  value: unknown,
  index: number,
  fallback: EquationAnnotation,
): EquationAnnotation {
  if (!value || typeof value !== "object") {
    return {
      ...fallback,
      id: `${fallback.id}-${index + 1}`,
    };
  }

  const candidate = value as Partial<EquationAnnotation>;
  const id = safeString(candidate.id, `${fallback.id}-${index + 1}`)
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

  return {
    id: id || `${fallback.id}-${index + 1}`,
    label: safeString(candidate.label, fallback.label).slice(0, 80),
    equation: safeString(candidate.equation, fallback.equation).slice(0, 120),
    explanation: safeString(candidate.explanation, fallback.explanation).slice(0, 240),
    variables: safeStringArray(candidate.variables, fallback.variables, 6, 90),
  };
}

function deriveEquationAnnotations(mode: DemoMode): EquationAnnotation[] {
  if (mode === "collision") {
    return [
      {
        id: "momentum",
        label: "Linear Momentum",
        equation: "p = m * v",
        explanation: "Momentum combines mass and velocity, so heavier bodies carry more impact for the same speed.",
        variables: ["p: momentum", "m: mass", "v: velocity"],
      },
      {
        id: "conservation",
        label: "Momentum Conservation",
        equation: "sum(p_before) = sum(p_after)",
        explanation: "In isolated interactions, total momentum remains approximately constant before and after collision.",
        variables: ["p_before: total momentum before impact", "p_after: total momentum after impact"],
      },
      {
        id: "restitution",
        label: "Coefficient of Restitution",
        equation: "e = relative speed after / relative speed before",
        explanation: "Higher restitution produces bouncier collisions and larger rebound speeds.",
        variables: ["e: restitution (0 to 1)"],
      },
    ];
  }

  if (mode === "projectile") {
    return [
      {
        id: "projectile-x",
        label: "Horizontal Motion",
        equation: "x = x0 + v0*cos(theta)*t",
        explanation: "Without horizontal acceleration, x changes linearly with time.",
        variables: ["x0: initial x", "v0: launch speed", "theta: launch angle", "t: time"],
      },
      {
        id: "projectile-y",
        label: "Vertical Motion",
        equation: "y = y0 + v0*sin(theta)*t - 0.5*g*t^2",
        explanation: "Gravity bends the path downward, creating the arc.",
        variables: ["y0: initial y", "g: gravity"],
      },
      {
        id: "projectile-range",
        label: "Range (Same Launch/landing Height)",
        equation: "R = (v0^2 * sin(2*theta)) / g",
        explanation: "For equal launch and landing heights, range depends strongly on angle and speed.",
        variables: ["R: horizontal range"],
      },
    ];
  }

  return [
    {
      id: "gravity-force",
      label: "Newton's Second Law",
      equation: "F = m * a",
      explanation:
        "The same acceleration can appear for objects with different mass when force scales with mass.",
      variables: ["F: net force", "m: mass", "a: acceleration"],
    },
    {
      id: "gravity-accel",
      label: "Free-Fall Acceleration",
      equation: "a = g",
      explanation:
        "Near Earth's surface, falling bodies accelerate at approximately the same rate regardless of mass.",
      variables: ["a: acceleration", "g: gravitational acceleration"],
    },
    {
      id: "gravity-motion",
      label: "Constant-Acceleration Position",
      equation: "y = y0 + v0*t + 0.5*g*t^2",
      explanation:
        "Vertical position evolves quadratically over time when gravity is approximately constant.",
      variables: ["y0: initial height", "v0: initial velocity", "g: gravity", "t: time"],
    },
  ];
}

function deriveLearningProfile(concept: string, mode: DemoMode): LearningProfile {
  const conceptSummary = concept.trim().slice(0, 120) || "the selected concept";
  const modeSpecificTip =
    mode === "collision"
      ? "Try changing bounciness and compare momentum transfer during impacts."
      : mode === "projectile"
        ? "Modify gravity and launch speed to compare arc height and horizontal range."
        : "Compare light and heavy objects to test whether fall acceleration changes.";

  return {
    sidebarTitle: "Interactive Learning Mode",
    coachPrompt: `Use the controls to test hypotheses about ${conceptSummary}.`,
    tutorTips: [
      "State a prediction before changing any controls.",
      modeSpecificTip,
      "Use equation annotations to justify what you observed.",
    ],
    checkpoints: [
      "Prediction recorded",
      "Experiment run",
      "Equation-backed explanation",
    ],
    equationAnnotations: deriveEquationAnnotations(mode),
  };
}

function safeDemoMode(value: unknown, fallback: DemoMode): DemoMode {
  if (value === "gravity" || value === "collision" || value === "projectile") {
    return value;
  }

  return fallback;
}

function normalizeDifficulty(value: unknown, fallback = DEFAULT_PLAN.difficulty): number {
  return Math.round(clamp(safeNumber(value, fallback), 1, 10));
}

export function getDefaultDesignPlan(): DesignPlan {
  return {
    ...DEFAULT_PLAN,
    mechanics: [...DEFAULT_PLAN.mechanics],
  };
}

export function mergeDesignPlan(
  incoming: Partial<DesignPlan> | null | undefined,
  prompt: string,
): DesignPlan {
  const fallback = deriveFallbackDesignPlan(prompt);
  if (!incoming) {
    return fallback;
  }

  return {
    title: safeString(incoming.title, fallback.title),
    concept: safeString(incoming.concept, fallback.concept),
    mechanics: Array.isArray(incoming.mechanics)
      ? incoming.mechanics
          .filter((entry): entry is string => typeof entry === "string")
          .map((entry) => entry.trim())
          .filter(Boolean)
          .slice(0, 8)
      : fallback.mechanics,
    winCondition: safeString(incoming.winCondition, fallback.winCondition),
    failCondition: safeString(incoming.failCondition, fallback.failCondition),
    difficulty: normalizeDifficulty(incoming.difficulty, fallback.difficulty),
  };
}

export function getDefaultGameConfig(): GameConfig {
  return {
    ...DEFAULT_CONFIG,
    player: { ...DEFAULT_CONFIG.player },
    obstacles: { ...DEFAULT_CONFIG.obstacles },
    arena: { ...DEFAULT_CONFIG.arena },
    rules: { ...DEFAULT_CONFIG.rules },
    visualization: { ...DEFAULT_CONFIG.visualization },
    demonstration: { ...DEFAULT_CONFIG.demonstration },
    learning: {
      ...DEFAULT_CONFIG.learning,
      tutorTips: [...DEFAULT_CONFIG.learning.tutorTips],
      checkpoints: [...DEFAULT_CONFIG.learning.checkpoints],
      equationAnnotations: DEFAULT_CONFIG.learning.equationAnnotations.map((annotation) => ({
        ...annotation,
        variables: [...annotation.variables],
      })),
    },
  };
}

export function mergeGameConfig(
  incoming: DeepPartial<GameConfig> | null | undefined,
): GameConfig {
  const base = getDefaultGameConfig();
  if (!incoming) {
    return base;
  }

  const player: DeepPartial<GameConfig["player"]> = incoming.player ?? {};
  const obstacles: DeepPartial<GameConfig["obstacles"]> = incoming.obstacles ?? {};
  const arena: DeepPartial<GameConfig["arena"]> = incoming.arena ?? {};
  const rules: DeepPartial<GameConfig["rules"]> = incoming.rules ?? {};
  const visualization: DeepPartial<GameConfig["visualization"]> =
    incoming.visualization ?? {};
  const demonstration: DeepPartial<GameConfig["demonstration"]> =
    incoming.demonstration ?? {};
  const learning: DeepPartial<GameConfig["learning"]> = incoming.learning ?? {};
  const resolvedMode = safeDemoMode(demonstration.mode, base.demonstration.mode);
  const fallbackLearning = deriveLearningProfile(
    safeString(incoming.concept, base.concept),
    resolvedMode,
  );
  const incomingAnnotations = Array.isArray(learning.equationAnnotations)
    ? learning.equationAnnotations
    : null;
  const equationAnnotations = (incomingAnnotations ?? fallbackLearning.equationAnnotations)
    .slice(0, 6)
    .map((annotation, index) =>
      normalizeEquationAnnotation(
        annotation,
        index,
        fallbackLearning.equationAnnotations[
          index % fallbackLearning.equationAnnotations.length
        ],
      ),
    );

  return {
    title: safeString(incoming.title, base.title).slice(0, 120),
    concept: safeString(incoming.concept, base.concept).slice(0, 240),
    goal: safeString(incoming.goal, base.goal).slice(0, 240),
    player: {
      speed: clamp(safeNumber(player.speed, base.player.speed), 120, 460),
      radius: clamp(safeNumber(player.radius, base.player.radius), 8, 28),
      color: safeColor(player.color, base.player.color),
    },
    obstacles: {
      count: Math.round(clamp(safeNumber(obstacles.count, base.obstacles.count), 2, 18)),
      speed: clamp(safeNumber(obstacles.speed, base.obstacles.speed), 60, 360),
      radius: clamp(safeNumber(obstacles.radius, base.obstacles.radius), 8, 24),
      color: safeColor(obstacles.color, base.obstacles.color),
      spread: clamp(safeNumber(obstacles.spread, base.obstacles.spread), 0.35, 1.2),
    },
    arena: {
      width: Math.round(clamp(safeNumber(arena.width, base.arena.width), 720, 1440)),
      height: Math.round(clamp(safeNumber(arena.height, base.arena.height), 420, 900)),
      background: safeColor(arena.background, base.arena.background),
      gridColor: safeColor(arena.gridColor, base.arena.gridColor),
    },
    rules: {
      lives: Math.round(clamp(safeNumber(rules.lives, base.rules.lives), 1, 7)),
      timer: Math.round(clamp(safeNumber(rules.timer, base.rules.timer), 20, 180)),
    },
    visualization: {
      showGrid: safeBoolean(visualization.showGrid, base.visualization.showGrid),
      showTrails: safeBoolean(visualization.showTrails, base.visualization.showTrails),
      showVelocityHints: safeBoolean(
        visualization.showVelocityHints,
        base.visualization.showVelocityHints,
      ),
      accent: safeColor(visualization.accent, base.visualization.accent),
    },
    demonstration: {
      mode: resolvedMode,
      summary: safeString(demonstration.summary, base.demonstration.summary).slice(0, 260),
      gravity: clamp(safeNumber(demonstration.gravity, base.demonstration.gravity), 0, 60),
      baseRestitution: clamp(
        safeNumber(demonstration.baseRestitution, base.demonstration.baseRestitution),
        0,
        1,
      ),
      spawnHeight: clamp(
        safeNumber(demonstration.spawnHeight, base.demonstration.spawnHeight),
        40,
        260,
      ),
    },
    learning: {
      sidebarTitle: safeString(learning.sidebarTitle, fallbackLearning.sidebarTitle).slice(
        0,
        80,
      ),
      coachPrompt: safeString(learning.coachPrompt, fallbackLearning.coachPrompt).slice(
        0,
        220,
      ),
      tutorTips: safeStringArray(learning.tutorTips, fallbackLearning.tutorTips, 8, 160),
      checkpoints: safeStringArray(
        learning.checkpoints,
        fallbackLearning.checkpoints,
        8,
        120,
      ),
      equationAnnotations,
    },
  };
}

function detectDifficulty(prompt: string): number {
  const text = prompt.toLowerCase();
  let difficulty = 5;

  if (/(easy|beginner|calm|relax)/.test(text)) {
    difficulty -= 2;
  }
  if (/(hard|expert|chaos|intense|bullet)/.test(text)) {
    difficulty += 2;
  }
  if (/(impossible|insane)/.test(text)) {
    difficulty += 2;
  }

  return Math.round(clamp(difficulty, 1, 10));
}

function selectPalette(prompt: string): {
  background: string;
  player: string;
  obstacle: string;
  grid: string;
  accent: string;
} {
  const text = prompt.toLowerCase();

  if (/(space|orbit|asteroid|galaxy)/.test(text)) {
    return {
      background: "#f4f7ff",
      player: "#2247a6",
      obstacle: "#6c45b8",
      grid: "#dae2fa",
      accent: "#2f58c9",
    };
  }

  if (/(ocean|water|wave|sea)/.test(text)) {
    return {
      background: "#f3fbfd",
      player: "#166d8f",
      obstacle: "#2c9a7a",
      grid: "#d4edf1",
      accent: "#167b92",
    };
  }

  if (/(forest|jungle|nature)/.test(text)) {
    return {
      background: "#f5f9f1",
      player: "#2f6b2e",
      obstacle: "#8e4f2f",
      grid: "#dce7d4",
      accent: "#2d7a42",
    };
  }

  return {
    background: DEFAULT_CONFIG.arena.background,
    player: DEFAULT_CONFIG.player.color,
    obstacle: DEFAULT_CONFIG.obstacles.color,
    grid: DEFAULT_CONFIG.arena.gridColor,
    accent: DEFAULT_CONFIG.visualization.accent,
  };
}

export function detectDemoMode(prompt: string): DemoMode {
  const text = prompt.toLowerCase();

  if (/(collision|impact|momentum|bounce)/.test(text)) {
    return "collision";
  }

  if (/(projectile|trajectory|launch|angle|arc)/.test(text)) {
    return "projectile";
  }

  if (/(gravity|drop|fall|mass|weight)/.test(text)) {
    return "gravity";
  }

  return "gravity";
}

export function deriveFallbackDesignPlan(prompt: string): DesignPlan {
  const trimmedPrompt = prompt.trim();
  const difficulty = detectDifficulty(trimmedPrompt);

  return {
    title: trimmedPrompt ? trimmedPrompt.slice(0, 96) : DEFAULT_PLAN.title,
    concept: trimmedPrompt || DEFAULT_PLAN.concept,
    mechanics: ["real-time movement", "collision avoidance", "timer pressure"],
    winCondition: "Survive through the full round timer.",
    failCondition: "Lose all lives from obstacle collisions.",
    difficulty,
  };
}

export function deriveFallbackConfig(
  prompt: string,
  plan?: Partial<DesignPlan> | null,
): GameConfig {
  const difficulty = normalizeDifficulty(plan?.difficulty ?? detectDifficulty(prompt));
  const palette = selectPalette(prompt);
  const mode = detectDemoMode(prompt);

  const gravityStrength = mode === "collision" ? 0 : mode === "projectile" ? 20 : 26;
  const restitution = mode === "collision" ? 0.9 : mode === "projectile" ? 0.45 : 0.28;
  const summary =
    mode === "collision"
      ? "Collisions conserve momentum while restitution controls bounce."
      : mode === "projectile"
        ? "A launch velocity and gravity produce a curved trajectory."
        : "Objects with different masses accelerate equally under gravity.";

  const config = mergeGameConfig({
    title: plan?.title ?? prompt,
    concept: plan?.concept ?? prompt,
    goal: plan?.winCondition,
    player: {
      speed: 210 + difficulty * 12,
      color: palette.player,
    },
    obstacles: {
      count: 4 + Math.round(difficulty * 0.8),
      speed: 88 + difficulty * 15,
      color: palette.obstacle,
      spread: 0.55 + difficulty * 0.05,
    },
    arena: {
      background: palette.background,
      gridColor: palette.grid,
    },
    rules: {
      lives: difficulty >= 8 ? 2 : difficulty <= 3 ? 4 : 3,
      timer: 50 + difficulty * 4,
    },
    visualization: {
      showGrid: true,
      showTrails: difficulty >= 5,
      showVelocityHints: difficulty >= 8,
      accent: palette.accent,
    },
    demonstration: {
      mode,
      summary,
      gravity: gravityStrength,
      baseRestitution: restitution,
      spawnHeight: 92,
    },
    learning: deriveLearningProfile(plan?.concept ?? prompt, mode),
  });

  if (/(minimal|clean)/i.test(prompt)) {
    config.visualization.showGrid = false;
    config.visualization.showTrails = false;
  }

  return config;
}
