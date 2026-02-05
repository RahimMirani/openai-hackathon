import { Vector2 } from "./types";

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function add(a: Vector2, b: Vector2): Vector2 {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function subtract(a: Vector2, b: Vector2): Vector2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function scale(vector: Vector2, factor: number): Vector2 {
  return { x: vector.x * factor, y: vector.y * factor };
}

export function dot(a: Vector2, b: Vector2): number {
  return a.x * b.x + a.y * b.y;
}

export function length(vector: Vector2): number {
  return Math.sqrt(dot(vector, vector));
}

export function normalize(vector: Vector2): Vector2 {
  const magnitude = length(vector);
  if (magnitude <= Number.EPSILON) {
    return { x: 0, y: 0 };
  }

  return scale(vector, 1 / magnitude);
}
