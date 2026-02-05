// AI Game Spec Generator
// Prompts the LLM to generate a complete GameSpec based on user input

import type { GameSpec } from "./types";
import { DEFAULT_GAME_SPEC } from "./types";

export const GAME_GENERATION_SYSTEM_PROMPT = `You are an expert game designer AI that creates interactive educational physics simulations.

When given a concept or topic, you generate a complete game specification as JSON that can be rendered on an HTML canvas.

## EXACT JSON SCHEMA (you MUST follow this exactly):

{
  "title": "string - descriptive name for this simulation",
  "description": "string - what this simulation demonstrates",
  "objective": "string - what the user should learn/observe",
  "canvas": {
    "width": 900,
    "height": 500,
    "background": "#hex color",
    "showGrid": true,
    "gridColor": "#hex color"
  },
  "physics": {
    "gravity": { "x": 0, "y": 400 },
    "friction": 0.1,
    "restitution": 0.7,
    "airResistance": 0.01
  },
  "entities": [
    {
      "id": "unique-id",
      "label": "Display Name",
      "shape": "circle" | "rectangle" | "triangle",
      "position": { "x": number, "y": number },
      "size": { "x": width, "y": height },
      "color": "#hex",
      "mass": 1,
      "velocity": { "x": 0, "y": 0 },
      "isStatic": false,
      "behaviors": [
        { "type": "gravity", "strength": 1 },
        { "type": "bounce" },
        { "type": "friction" }
      ]
    }
  ],
  "interactions": [
    { "entityA": "id1", "entityB": "id2", "action": "bounce" }
  ],
  "ui": {
    "showTimer": false,
    "showScore": false,
    "showVelocityVectors": true,
    "showTrails": true
  },
  "learning": {
    "concept": "string",
    "equations": [
      {
        "name": "Equation Name",
        "formula": "v = v₀ + at",
        "explanation": "What this equation means",
        "variables": ["v: final velocity", "a: acceleration"]
      }
    ],
    "tips": ["Tip 1", "Tip 2"],
    "checkpoints": ["Observe X", "Notice Y"]
  },
  "controls": [
    {
      "id": "gravity-control",
      "label": "Gravity",
      "type": "slider",
      "target": "physics.gravity.y",
      "min": 0,
      "max": 1000,
      "step": 50,
      "default": 400
    }
  ]
}

## AVAILABLE BEHAVIORS (pick what makes sense for the concept):
- gravity: { type: "gravity", strength: 1 } - Apply gravitational force
- bounce: { type: "bounce" } - Bounce off surfaces
- friction: { type: "friction" } - Slow down over time  
- oscillate: { type: "oscillate", frequency: 2, amplitude: 50, axis: "y" } - Move back/forth
- follow_mouse: { type: "follow_mouse", strength: 0.5 } - Track cursor
- keyboard_control: { type: "keyboard_control", strength: 1, keys: { up: "w", down: "s", left: "a", right: "d" } }
- rotate: { type: "rotate", frequency: 1 } - Spin continuously
- orbit: { type: "orbit", target: "other-entity-id", frequency: 1, amplitude: 100 } - Circle around another entity
- spring: { type: "spring", target: "other-entity-id", strength: 0.5, damping: 0.1 } - Elastic connection
- attract: { type: "attract", target: "other-entity-id", strength: 1 } - Pull other entities
- repel: { type: "repel", target: "other-entity-id", strength: 1 } - Push other entities away

## RULES:
1. Create INTERESTING, UNIQUE simulations - NOT just a ball falling
2. Use multiple entities that interact meaningfully
3. Match the simulation to the concept being taught
4. Include relevant physics equations
5. Provide 2-4 interactive controls for experimentation
6. Use visually distinct colors for different entities

Respond with ONLY the JSON object. No markdown, no explanation, no code blocks - just raw JSON.`;

export function buildGameGenerationPrompt(userInput: string, conceptNode?: { title?: string; objective?: string }): string {
  const conceptTitle = conceptNode?.title ?? userInput;
  const conceptObjective = conceptNode?.objective ?? `Interactive demonstration of ${userInput}`;

  return `Generate a physics simulation for:

TOPIC: ${conceptTitle}
GOAL: ${conceptObjective}
USER REQUEST: ${userInput}

Create something UNIQUE and INTERESTING that demonstrates this concept visually. 
- If it's about orbits, create planets orbiting a sun
- If it's about collisions, create multiple balls that collide
- If it's about waves, create oscillating particles
- If it's about springs, create connected bouncing objects
- If it's about gravity, show objects of different masses falling

DO NOT just create a single ball. Create a complete interactive demonstration.

Return ONLY the JSON object (no markdown, no code blocks).`;
}

// Parse and validate the LLM response
export function parseGameSpec(llmOutput: string): GameSpec | null {
  try {
    // Try to extract JSON from the response
    let jsonStr = llmOutput.trim();
    
    console.log("[parseGameSpec] Input length:", jsonStr.length);
    console.log("[parseGameSpec] First 200 chars:", jsonStr.slice(0, 200));
    
    // Remove markdown code blocks if present (various formats)
    const codeBlockPatterns = [
      /```json\s*([\s\S]*?)```/i,
      /```\s*([\s\S]*?)```/,
      /`([\s\S]*?)`/,
    ];
    
    for (const pattern of codeBlockPatterns) {
      const match = jsonStr.match(pattern);
      if (match && match[1].includes('{')) {
        jsonStr = match[1].trim();
        console.log("[parseGameSpec] Extracted from code block");
        break;
      }
    }
    
    // Try to find JSON object - find the outermost braces
    const firstBrace = jsonStr.indexOf('{');
    const lastBrace = jsonStr.lastIndexOf('}');
    
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      jsonStr = jsonStr.slice(firstBrace, lastBrace + 1);
      console.log("[parseGameSpec] Extracted JSON object, length:", jsonStr.length);
    }

    const parsed = JSON.parse(jsonStr);
    
    console.log("[parseGameSpec] Parsed successfully, has entities:", !!parsed.entities);
    
    // Validate required fields exist
    if (!parsed.entities || !Array.isArray(parsed.entities)) {
      console.warn("[parseGameSpec] Missing entities array, using defaults");
      return mergeWithDefaults(parsed);
    }

    return mergeWithDefaults(parsed);
  } catch (error) {
    console.error("[parseGameSpec] Failed to parse:", error);
    console.error("[parseGameSpec] Problematic output:", llmOutput.slice(0, 500));
    return null;
  }
}

// Merge partial spec with defaults
function mergeWithDefaults(partial: Partial<GameSpec>): GameSpec {
  return {
    title: partial.title ?? DEFAULT_GAME_SPEC.title,
    description: partial.description ?? DEFAULT_GAME_SPEC.description,
    objective: partial.objective ?? DEFAULT_GAME_SPEC.objective,
    canvas: {
      ...DEFAULT_GAME_SPEC.canvas,
      ...partial.canvas,
    },
    physics: {
      ...DEFAULT_GAME_SPEC.physics,
      ...partial.physics,
    },
    entities: partial.entities ?? DEFAULT_GAME_SPEC.entities,
    interactions: partial.interactions ?? DEFAULT_GAME_SPEC.interactions,
    winCondition: partial.winCondition,
    loseCondition: partial.loseCondition,
    ui: {
      ...DEFAULT_GAME_SPEC.ui,
      ...partial.ui,
    },
    learning: {
      ...DEFAULT_GAME_SPEC.learning,
      ...partial.learning,
    },
    controls: partial.controls ?? DEFAULT_GAME_SPEC.controls,
  };
}

// Validate entity specs
export function validateEntities(spec: GameSpec): string[] {
  const errors: string[] = [];
  const entityIds = new Set<string>();

  for (const entity of spec.entities) {
    if (!entity.id) {
      errors.push("Entity missing id");
      continue;
    }
    
    if (entityIds.has(entity.id)) {
      errors.push(`Duplicate entity id: ${entity.id}`);
    }
    entityIds.add(entity.id);

    if (!entity.shape) {
      errors.push(`Entity ${entity.id} missing shape`);
    }
    
    if (!entity.position) {
      errors.push(`Entity ${entity.id} missing position`);
    }
    
    if (!entity.size) {
      errors.push(`Entity ${entity.id} missing size`);
    }
    
    if (!entity.color) {
      errors.push(`Entity ${entity.id} missing color`);
    }

    // Validate behavior references
    for (const behavior of entity.behaviors ?? []) {
      if (behavior.target && !entityIds.has(behavior.target) && behavior.target !== entity.id) {
        // Target entity must exist (we check this later)
      }
    }
  }

  return errors;
}
