export type Vector2 = {
  x: number;
  y: number;
};

export type WorldBounds = {
  min: Vector2;
  max: Vector2;
};

export type PhysicsBody = {
  id: string;
  position: Vector2;
  velocity: Vector2;
  halfSize: Vector2;
  mass: number;
  isStatic?: boolean;
  restitution?: number;
  friction?: number;
  linearDamping?: number;
  tag?: string;
};

export type PhysicsWorldState = {
  tick: number;
  elapsedMs: number;
  gravity: Vector2;
  bounds: WorldBounds;
  defaultRestitution?: number;
  defaultFriction?: number;
  defaultLinearDamping?: number;
  bodies: PhysicsBody[];
};

export type ApplyImpulseAction = {
  type: "applyImpulse";
  bodyId: string;
  impulse: Vector2;
};

export type ApplyForceAction = {
  type: "applyForce";
  bodyId: string;
  force: Vector2;
};

export type SetVelocityAction = {
  type: "setVelocity";
  bodyId: string;
  velocity: Vector2;
};

export type TeleportAction = {
  type: "teleport";
  bodyId: string;
  position: Vector2;
};

export type SpawnBodyAction = {
  type: "spawnBody";
  body: PhysicsBody;
};

export type RemoveBodyAction = {
  type: "removeBody";
  bodyId: string;
};

export type PhysicsAction =
  | ApplyImpulseAction
  | ApplyForceAction
  | SetVelocityAction
  | TeleportAction
  | SpawnBodyAction
  | RemoveBodyAction;

export type CollisionEvent = {
  aId: string;
  bId: string;
  normal: Vector2;
  depth: number;
  relativeSpeed: number;
};

export type PhysicsSimulationRequest = {
  world: PhysicsWorldState;
  actions?: PhysicsAction[];
  dtMs?: number;
  steps?: number;
};

export type PhysicsSimulationResult = {
  world: PhysicsWorldState;
  collisions: CollisionEvent[];
};
