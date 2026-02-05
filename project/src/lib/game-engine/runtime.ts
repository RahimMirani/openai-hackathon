// Dynamic Game Runtime - Interprets GameSpec and runs simulation

import type { 
  GameSpec, 
  EntitySpec, 
  BehaviorConfig, 
  Vector2 
} from "./types";

export type RuntimeEntity = EntitySpec & {
  prevPosition: Vector2;
  acceleration: Vector2;
  angularVelocity: number;
  trail: Vector2[];
  alive: boolean;
};

export type RuntimeState = {
  entities: Map<string, RuntimeEntity>;
  score: number;
  elapsed: number;
  paused: boolean;
  won: boolean;
  lost: boolean;
  mousePosition: Vector2;
  keysPressed: Set<string>;
};

export function initializeRuntime(spec: GameSpec): RuntimeState {
  const entities = new Map<string, RuntimeEntity>();
  
  for (const entitySpec of spec.entities) {
    entities.set(entitySpec.id, {
      ...entitySpec,
      velocity: entitySpec.velocity ?? { x: 0, y: 0 },
      prevPosition: { ...entitySpec.position },
      acceleration: { x: 0, y: 0 },
      angularVelocity: 0,
      trail: [],
      alive: true,
    });
  }

  return {
    entities,
    score: 0,
    elapsed: 0,
    paused: false,
    won: false,
    lost: false,
    mousePosition: { x: 0, y: 0 },
    keysPressed: new Set(),
  };
}

function applyBehavior(
  entity: RuntimeEntity,
  behavior: BehaviorConfig,
  spec: GameSpec,
  state: RuntimeState,
  dt: number
): void {
  const strength = behavior.strength ?? 1;

  switch (behavior.type) {
    case "gravity": {
      if (!entity.isStatic) {
        entity.acceleration.x += spec.physics.gravity.x * strength;
        entity.acceleration.y += spec.physics.gravity.y * strength;
      }
      break;
    }

    case "friction": {
      if (!entity.isStatic && entity.velocity) {
        const friction = spec.physics.friction * strength;
        entity.velocity.x *= (1 - friction * dt);
        entity.velocity.y *= (1 - friction * dt);
      }
      break;
    }

    case "oscillate": {
      const freq = behavior.frequency ?? 2;
      const amp = behavior.amplitude ?? 50;
      const axis = behavior.axis ?? "y";
      const offset = Math.sin(state.elapsed * freq * Math.PI * 2) * amp;
      
      if (axis === "x" || axis === "both") {
        entity.position.x += offset * dt * 60;
      }
      if (axis === "y" || axis === "both") {
        entity.position.y += offset * dt * 60;
      }
      break;
    }

    case "follow_mouse": {
      if (!entity.isStatic) {
        const dx = state.mousePosition.x - entity.position.x;
        const dy = state.mousePosition.y - entity.position.y;
        entity.velocity!.x += dx * strength * dt * 10;
        entity.velocity!.y += dy * strength * dt * 10;
      }
      break;
    }

    case "keyboard_control": {
      if (!entity.isStatic) {
        const speed = strength * 300;
        const keys = behavior.keys ?? { up: "w", down: "s", left: "a", right: "d" };
        
        if (keys.up && state.keysPressed.has(keys.up)) {
          entity.velocity!.y -= speed * dt;
        }
        if (keys.down && state.keysPressed.has(keys.down)) {
          entity.velocity!.y += speed * dt;
        }
        if (keys.left && state.keysPressed.has(keys.left)) {
          entity.velocity!.x -= speed * dt;
        }
        if (keys.right && state.keysPressed.has(keys.right)) {
          entity.velocity!.x += speed * dt;
        }
      }
      break;
    }

    case "rotate": {
      const rotSpeed = (behavior.frequency ?? 1) * Math.PI * 2;
      entity.rotation = (entity.rotation ?? 0) + rotSpeed * dt * strength;
      break;
    }

    case "pulse": {
      const freq = behavior.frequency ?? 2;
      const amp = behavior.amplitude ?? 0.2;
      const scale = 1 + Math.sin(state.elapsed * freq * Math.PI * 2) * amp;
      // Store original size if not stored
      entity.size.x *= scale;
      entity.size.y *= scale;
      break;
    }

    case "orbit": {
      if (behavior.target) {
        const targetEntity = state.entities.get(behavior.target);
        if (targetEntity) {
          const radius = behavior.amplitude ?? 100;
          const speed = (behavior.frequency ?? 1) * Math.PI * 2;
          const angle = state.elapsed * speed;
          entity.position.x = targetEntity.position.x + Math.cos(angle) * radius;
          entity.position.y = targetEntity.position.y + Math.sin(angle) * radius;
        }
      }
      break;
    }

    case "spring": {
      if (behavior.target && !entity.isStatic) {
        const targetEntity = state.entities.get(behavior.target);
        if (targetEntity) {
          const dx = targetEntity.position.x - entity.position.x;
          const dy = targetEntity.position.y - entity.position.y;
          const damping = behavior.damping ?? 0.1;
          entity.velocity!.x += dx * strength * dt * 10;
          entity.velocity!.y += dy * strength * dt * 10;
          entity.velocity!.x *= (1 - damping);
          entity.velocity!.y *= (1 - damping);
        }
      }
      break;
    }

    case "wrap_screen": {
      if (entity.position.x < 0) entity.position.x = spec.canvas.width;
      if (entity.position.x > spec.canvas.width) entity.position.x = 0;
      if (entity.position.y < 0) entity.position.y = spec.canvas.height;
      if (entity.position.y > spec.canvas.height) entity.position.y = 0;
      break;
    }

    case "destroy_offscreen": {
      const margin = 100;
      if (
        entity.position.x < -margin ||
        entity.position.x > spec.canvas.width + margin ||
        entity.position.y < -margin ||
        entity.position.y > spec.canvas.height + margin
      ) {
        entity.alive = false;
      }
      break;
    }

    case "attract": {
      if (behavior.target) {
        const targetEntity = state.entities.get(behavior.target);
        if (targetEntity && !targetEntity.isStatic) {
          const dx = entity.position.x - targetEntity.position.x;
          const dy = entity.position.y - targetEntity.position.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = strength * 1000 / (dist * dist);
          targetEntity.velocity!.x += (dx / dist) * force * dt;
          targetEntity.velocity!.y += (dy / dist) * force * dt;
        }
      }
      break;
    }

    case "repel": {
      if (behavior.target) {
        const targetEntity = state.entities.get(behavior.target);
        if (targetEntity && !targetEntity.isStatic) {
          const dx = targetEntity.position.x - entity.position.x;
          const dy = targetEntity.position.y - entity.position.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = strength * 1000 / (dist * dist);
          targetEntity.velocity!.x += (dx / dist) * force * dt;
          targetEntity.velocity!.y += (dy / dist) * force * dt;
        }
      }
      break;
    }
  }
}

function checkCollision(a: RuntimeEntity, b: RuntimeEntity): boolean {
  // Simple AABB collision
  const aLeft = a.position.x - a.size.x / 2;
  const aRight = a.position.x + a.size.x / 2;
  const aTop = a.position.y - a.size.y / 2;
  const aBottom = a.position.y + a.size.y / 2;

  const bLeft = b.position.x - b.size.x / 2;
  const bRight = b.position.x + b.size.x / 2;
  const bTop = b.position.y - b.size.y / 2;
  const bBottom = b.position.y + b.size.y / 2;

  return aLeft < bRight && aRight > bLeft && aTop < bBottom && aBottom > bTop;
}

function resolveCollision(
  a: RuntimeEntity,
  b: RuntimeEntity,
  restitution: number
): void {
  if (a.isStatic && b.isStatic) return;

  // Calculate overlap
  const overlapX = Math.min(
    a.position.x + a.size.x / 2 - (b.position.x - b.size.x / 2),
    b.position.x + b.size.x / 2 - (a.position.x - a.size.x / 2)
  );
  const overlapY = Math.min(
    a.position.y + a.size.y / 2 - (b.position.y - b.size.y / 2),
    b.position.y + b.size.y / 2 - (a.position.y - a.size.y / 2)
  );

  // Determine collision normal
  const isHorizontal = overlapX < overlapY;

  if (isHorizontal) {
    const sign = a.position.x < b.position.x ? -1 : 1;
    if (!a.isStatic) a.position.x += sign * overlapX / 2;
    if (!b.isStatic) b.position.x -= sign * overlapX / 2;

    // Bounce
    if (!a.isStatic && a.velocity) a.velocity.x *= -restitution;
    if (!b.isStatic && b.velocity) b.velocity.x *= -restitution;
  } else {
    const sign = a.position.y < b.position.y ? -1 : 1;
    if (!a.isStatic) a.position.y += sign * overlapY / 2;
    if (!b.isStatic) b.position.y -= sign * overlapY / 2;

    // Bounce
    if (!a.isStatic && a.velocity) a.velocity.y *= -restitution;
    if (!b.isStatic && b.velocity) b.velocity.y *= -restitution;
  }
}

export function stepSimulation(
  spec: GameSpec,
  state: RuntimeState,
  dt: number
): RuntimeState {
  if (state.paused || state.won || state.lost) {
    return state;
  }

  state.elapsed += dt;

  // Update each entity
  for (const entity of state.entities.values()) {
    if (!entity.alive) continue;

    // Reset acceleration
    entity.acceleration = { x: 0, y: 0 };

    // Apply behaviors
    for (const behavior of entity.behaviors) {
      applyBehavior(entity, behavior, spec, state, dt);
    }

    // Apply air resistance
    if (!entity.isStatic && entity.velocity) {
      entity.velocity.x *= (1 - spec.physics.airResistance);
      entity.velocity.y *= (1 - spec.physics.airResistance);
    }

    // Integrate velocity
    if (!entity.isStatic && entity.velocity) {
      entity.velocity.x += entity.acceleration.x * dt;
      entity.velocity.y += entity.acceleration.y * dt;

      entity.prevPosition = { ...entity.position };
      entity.position.x += entity.velocity.x * dt;
      entity.position.y += entity.velocity.y * dt;
    }

    // Update trail
    if (spec.ui.showTrails && !entity.isStatic) {
      entity.trail.unshift({ ...entity.position });
      if (entity.trail.length > 50) {
        entity.trail.pop();
      }
    }
  }

  // Check collisions and interactions
  const entityList = [...state.entities.values()].filter(e => e.alive);
  for (let i = 0; i < entityList.length; i++) {
    for (let j = i + 1; j < entityList.length; j++) {
      const a = entityList[i];
      const b = entityList[j];

      if (checkCollision(a, b)) {
        // Find matching interaction rule
        const rule = spec.interactions.find(
          r =>
            (r.entityA === a.id && r.entityB === b.id) ||
            (r.entityA === b.id && r.entityB === a.id) ||
            r.entityA === "*" ||
            r.entityB === "*"
        );

        if (rule) {
          switch (rule.action) {
            case "bounce":
              resolveCollision(a, b, spec.physics.restitution);
              break;
            case "destroy":
              if (!a.isStatic) a.alive = false;
              if (!b.isStatic) b.alive = false;
              break;
            case "score":
              state.score += Number(rule.parameters?.points ?? 1);
              break;
          }
        } else {
          // Default: bounce
          resolveCollision(a, b, spec.physics.restitution);
        }
      }
    }
  }

  // Check win/lose conditions
  if (spec.winCondition) {
    switch (spec.winCondition.type) {
      case "time_survived":
        if (state.elapsed >= (spec.winCondition.duration ?? 30)) {
          state.won = true;
        }
        break;
      case "score_reached":
        if (state.score >= (spec.winCondition.target as number ?? 10)) {
          state.won = true;
        }
        break;
      case "all_destroyed":
        const targetType = spec.winCondition.target as string;
        const remaining = [...state.entities.values()].filter(
          e => e.alive && e.id.includes(targetType)
        );
        if (remaining.length === 0) {
          state.won = true;
        }
        break;
    }
  }

  if (spec.loseCondition) {
    switch (spec.loseCondition.type) {
      case "entity_destroyed":
        const entity = state.entities.get(spec.loseCondition.entityId ?? "");
        if (entity && !entity.alive) {
          state.lost = true;
        }
        break;
      case "time_exceeded":
        if (state.elapsed >= (spec.loseCondition.duration ?? 60)) {
          state.lost = true;
        }
        break;
    }
  }

  return state;
}

export function renderGame(
  ctx: CanvasRenderingContext2D,
  spec: GameSpec,
  state: RuntimeState
): void {
  const { width, height } = spec.canvas;

  // Clear and fill background
  ctx.fillStyle = spec.canvas.background;
  ctx.fillRect(0, 0, width, height);

  // Draw grid
  if (spec.canvas.showGrid) {
    ctx.strokeStyle = spec.canvas.gridColor ?? "#e0e0e0";
    ctx.lineWidth = 1;
    const gridSize = 50;
    for (let x = 0; x <= width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y <= height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  }

  // Sort entities by layer
  const sortedEntities = [...state.entities.values()]
    .filter(e => e.alive)
    .sort((a, b) => (a.layer ?? 0) - (b.layer ?? 0));

  // Draw entities
  for (const entity of sortedEntities) {
    ctx.save();
    ctx.translate(entity.position.x, entity.position.y);
    
    if (entity.rotation) {
      ctx.rotate(entity.rotation);
    }

    // Draw trail
    if (spec.ui.showTrails && entity.trail.length > 1) {
      ctx.beginPath();
      ctx.moveTo(entity.trail[0].x - entity.position.x, entity.trail[0].y - entity.position.y);
      for (let i = 1; i < entity.trail.length; i++) {
        const alpha = 1 - i / entity.trail.length;
        ctx.strokeStyle = `${entity.color}${Math.floor(alpha * 50).toString(16).padStart(2, '0')}`;
        ctx.lineTo(entity.trail[i].x - entity.position.x, entity.trail[i].y - entity.position.y);
      }
      ctx.stroke();
    }

    // Draw shape
    ctx.fillStyle = entity.color;
    
    switch (entity.shape) {
      case "circle":
        ctx.beginPath();
        ctx.arc(0, 0, entity.size.x / 2, 0, Math.PI * 2);
        ctx.fill();
        break;
      
      case "rectangle":
        ctx.fillRect(-entity.size.x / 2, -entity.size.y / 2, entity.size.x, entity.size.y);
        break;
      
      case "triangle":
        ctx.beginPath();
        ctx.moveTo(0, -entity.size.y / 2);
        ctx.lineTo(entity.size.x / 2, entity.size.y / 2);
        ctx.lineTo(-entity.size.x / 2, entity.size.y / 2);
        ctx.closePath();
        ctx.fill();
        break;
    }

    // Draw velocity vector
    if (spec.ui.showVelocityVectors && entity.velocity && !entity.isStatic) {
      const vx = entity.velocity.x * 0.1;
      const vy = entity.velocity.y * 0.1;
      ctx.strokeStyle = "#ff6b6b";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(vx, vy);
      ctx.stroke();
      
      // Arrow head
      const angle = Math.atan2(vy, vx);
      ctx.beginPath();
      ctx.moveTo(vx, vy);
      ctx.lineTo(vx - 8 * Math.cos(angle - 0.4), vy - 8 * Math.sin(angle - 0.4));
      ctx.moveTo(vx, vy);
      ctx.lineTo(vx - 8 * Math.cos(angle + 0.4), vy - 8 * Math.sin(angle + 0.4));
      ctx.stroke();
    }

    // Draw label
    if (entity.label) {
      ctx.fillStyle = "#333";
      ctx.font = "12px system-ui";
      ctx.textAlign = "center";
      ctx.fillText(entity.label, 0, -entity.size.y / 2 - 8);
    }

    ctx.restore();
  }

  // Draw UI
  ctx.fillStyle = "#333";
  ctx.font = "14px system-ui";
  ctx.textAlign = "left";
  
  let uiY = 20;
  
  if (spec.ui.showTimer) {
    ctx.fillText(`Time: ${state.elapsed.toFixed(1)}s`, 10, uiY);
    uiY += 20;
  }
  
  if (spec.ui.showScore) {
    ctx.fillText(`Score: ${state.score}`, 10, uiY);
    uiY += 20;
  }

  // Draw win/lose state
  if (state.won || state.lost) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = state.won ? "#2b6f6a" : "#a94444";
    ctx.font = "bold 48px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(state.won ? "You Win!" : "Game Over", width / 2, height / 2);
  }
}
