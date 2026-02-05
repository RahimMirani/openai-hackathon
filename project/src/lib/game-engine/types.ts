// Dynamic Game Entity System
// AI generates these specs, runtime interprets them

export type Vector2 = { x: number; y: number };

export type EntityShape = "circle" | "rectangle" | "triangle";

export type BehaviorType =
  | "gravity"
  | "bounce"
  | "drag"
  | "oscillate"
  | "follow_mouse"
  | "keyboard_control"
  | "rotate"
  | "pulse"
  | "orbit"
  | "spring"
  | "friction"
  | "wrap_screen"
  | "destroy_offscreen"
  | "spawn_on_click"
  | "collision_bounce"
  | "attract"
  | "repel";

export type BehaviorConfig = {
  type: BehaviorType;
  strength?: number;
  axis?: "x" | "y" | "both";
  target?: string; // entity id to interact with
  frequency?: number;
  amplitude?: number;
  damping?: number;
  keys?: { up?: string; down?: string; left?: string; right?: string };
};

export type EntitySpec = {
  id: string;
  label?: string;
  shape: EntityShape;
  position: Vector2;
  size: Vector2;
  color: string;
  mass?: number;
  velocity?: Vector2;
  rotation?: number;
  isStatic?: boolean;
  behaviors: BehaviorConfig[];
  layer?: number; // z-index for rendering
};

export type InteractionRule = {
  entityA: string; // entity id or "*" for any
  entityB: string;
  action: "bounce" | "destroy" | "stick" | "score" | "trigger" | "transfer_velocity";
  parameters?: Record<string, number | string | boolean>;
};

export type WinCondition = {
  type: "time_survived" | "score_reached" | "all_destroyed" | "entity_reached" | "custom";
  target?: number | string;
  duration?: number;
};

export type LoseCondition = {
  type: "entity_destroyed" | "entity_offscreen" | "time_exceeded" | "collision" | "custom";
  entityId?: string;
  duration?: number;
};

export type GameSpec = {
  title: string;
  description: string;
  objective: string;
  
  // Canvas settings
  canvas: {
    width: number;
    height: number;
    background: string;
    showGrid?: boolean;
    gridColor?: string;
  };

  // Global physics
  physics: {
    gravity: Vector2;
    friction: number;
    restitution: number; // bounciness
    airResistance: number;
  };

  // All entities in the scene
  entities: EntitySpec[];

  // How entities interact
  interactions: InteractionRule[];

  // Win/lose conditions
  winCondition?: WinCondition;
  loseCondition?: LoseCondition;

  // UI elements to show
  ui: {
    showTimer?: boolean;
    showScore?: boolean;
    showVelocityVectors?: boolean;
    showTrails?: boolean;
    customInstructions?: string;
  };

  // Learning content
  learning: {
    concept: string;
    equations: Array<{
      name: string;
      formula: string;
      explanation: string;
      variables: string[];
    }>;
    tips: string[];
    checkpoints: string[];
  };

  // Interactive controls the user can adjust
  controls: Array<{
    id: string;
    label: string;
    type: "slider" | "toggle" | "button";
    target: string; // what property to modify
    min?: number;
    max?: number;
    step?: number;
    default?: number | boolean;
  }>;
};

// Default game spec for fallback
export const DEFAULT_GAME_SPEC: GameSpec = {
  title: "Physics Sandbox",
  description: "Interactive physics demonstration",
  objective: "Explore how objects behave under different physics conditions",
  canvas: {
    width: 900,
    height: 500,
    background: "#fbfaf7",
    showGrid: true,
    gridColor: "#e9e2d6",
  },
  physics: {
    gravity: { x: 0, y: 400 },
    friction: 0.1,
    restitution: 0.7,
    airResistance: 0.01,
  },
  entities: [
    {
      id: "ball-1",
      label: "Ball",
      shape: "circle",
      position: { x: 450, y: 100 },
      size: { x: 30, y: 30 },
      color: "#2b6f6a",
      mass: 1,
      velocity: { x: 0, y: 0 },
      behaviors: [
        { type: "gravity", strength: 1 },
        { type: "bounce" },
        { type: "friction" },
      ],
    },
    {
      id: "ground",
      label: "Ground",
      shape: "rectangle",
      position: { x: 450, y: 480 },
      size: { x: 800, y: 40 },
      color: "#5f5546",
      isStatic: true,
      behaviors: [],
    },
  ],
  interactions: [
    {
      entityA: "ball-1",
      entityB: "ground",
      action: "bounce",
    },
  ],
  ui: {
    showTimer: false,
    showScore: false,
    showVelocityVectors: true,
    showTrails: true,
  },
  learning: {
    concept: "Basic physics simulation",
    equations: [
      {
        name: "Kinematic Equation",
        formula: "v = v₀ + at",
        explanation: "Velocity changes over time due to acceleration",
        variables: ["v: final velocity", "v₀: initial velocity", "a: acceleration", "t: time"],
      },
    ],
    tips: ["Watch how gravity accelerates the ball downward", "Notice the bounce reduces energy each time"],
    checkpoints: ["Observe the ball falling", "Count how many bounces occur"],
  },
  controls: [
    {
      id: "gravity",
      label: "Gravity",
      type: "slider",
      target: "physics.gravity.y",
      min: 0,
      max: 1000,
      step: 50,
      default: 400,
    },
    {
      id: "bounciness",
      label: "Bounciness",
      type: "slider",
      target: "physics.restitution",
      min: 0,
      max: 1,
      step: 0.1,
      default: 0.7,
    },
  ],
};
