"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  type GameSpec,
  type RuntimeState,
  DEFAULT_GAME_SPEC,
  initializeRuntime,
  stepSimulation,
  renderGame,
} from "@/lib/game-engine";

type StoredGame = {
  gameSpec?: GameSpec;
  conceptNode?: {
    id?: string;
    title?: string;
    objective?: string;
  };
};

const STORAGE_KEY = "age.dynamicGames";
const STORAGE_SINGLE = "age.gameSpec";

function loadGamesFromStorage(): GameSpec[] {
  if (typeof window === "undefined") {
    return [DEFAULT_GAME_SPEC];
  }

  // Try loading multiple games
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as StoredGame[];
      const specs = parsed
        .map((g) => g.gameSpec)
        .filter((s): s is GameSpec => s !== undefined);
      if (specs.length > 0) return specs;
    } catch {}
  }

  // Try loading single game
  const single = localStorage.getItem(STORAGE_SINGLE);
  if (single) {
    try {
      const parsed = JSON.parse(single) as GameSpec;
      if (parsed.entities) return [parsed];
    } catch {}
  }

  return [DEFAULT_GAME_SPEC];
}

export default function DynamicGameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<RuntimeState | null>(null);
  const animationRef = useRef<number>(0);

  const [games] = useState<GameSpec[]>(loadGamesFromStorage);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [controlValues, setControlValues] = useState<Record<string, number | boolean>>({});

  const activeSpec = games[activeIndex] ?? DEFAULT_GAME_SPEC;

  // Initialize control values
  useEffect(() => {
    const initial: Record<string, number | boolean> = {};
    for (const ctrl of activeSpec.controls) {
      initial[ctrl.id] = ctrl.default ?? (ctrl.type === "toggle" ? false : ctrl.min ?? 0);
    }
    setControlValues(initial);
  }, [activeSpec]);

  // Apply control changes to spec
  const getModifiedSpec = useCallback((): GameSpec => {
    const spec = { ...activeSpec };
    
    for (const ctrl of spec.controls) {
      const value = controlValues[ctrl.id];
      if (value === undefined) continue;

      // Parse the target path and apply value
      const parts = ctrl.target.split(".");
      let obj: Record<string, unknown> = spec as Record<string, unknown>;
      
      for (let i = 0; i < parts.length - 1; i++) {
        if (obj[parts[i]] && typeof obj[parts[i]] === "object") {
          obj = obj[parts[i]] as Record<string, unknown>;
        }
      }
      
      const lastKey = parts[parts.length - 1];
      obj[lastKey] = value;
    }

    return spec;
  }, [activeSpec, controlValues]);

  // Reset simulation
  const resetSimulation = useCallback(() => {
    const spec = getModifiedSpec();
    stateRef.current = initializeRuntime(spec);
  }, [getModifiedSpec]);

  // Initialize runtime
  useEffect(() => {
    resetSimulation();
  }, [resetSimulation]);

  // Main game loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const spec = getModifiedSpec();
    
    // Set canvas size
    const container = containerRef.current;
    if (container) {
      const scale = Math.min(1, container.clientWidth / spec.canvas.width);
      canvas.width = spec.canvas.width * window.devicePixelRatio;
      canvas.height = spec.canvas.height * window.devicePixelRatio;
      canvas.style.width = `${spec.canvas.width * scale}px`;
      canvas.style.height = `${spec.canvas.height * scale}px`;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    }

    let lastTime = performance.now();

    const loop = (time: number) => {
      const dt = Math.min(0.05, (time - lastTime) / 1000);
      lastTime = time;

      if (stateRef.current && !isPaused) {
        stateRef.current = stepSimulation(spec, stateRef.current, dt);
      }

      if (stateRef.current) {
        ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
        renderGame(ctx, spec, stateRef.current);
      }

      animationRef.current = requestAnimationFrame(loop);
    };

    animationRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [getModifiedSpec, isPaused]);

  // Mouse tracking
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = activeSpec.canvas.width / rect.width;
      const scaleY = activeSpec.canvas.height / rect.height;
      
      if (stateRef.current) {
        stateRef.current.mousePosition = {
          x: (e.clientX - rect.left) * scaleX,
          y: (e.clientY - rect.top) * scaleY,
        };
      }
    };

    canvas.addEventListener("mousemove", handleMouseMove);
    return () => canvas.removeEventListener("mousemove", handleMouseMove);
  }, [activeSpec.canvas.width, activeSpec.canvas.height]);

  // Keyboard tracking
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (stateRef.current) {
        stateRef.current.keysPressed.add(e.key.toLowerCase());
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (stateRef.current) {
        stateRef.current.keysPressed.delete(e.key.toLowerCase());
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  const handleControlChange = (id: string, value: number | boolean) => {
    setControlValues((prev) => ({ ...prev, [id]: value }));
  };

  const switchGame = (index: number) => {
    setActiveIndex(index);
    setIsPaused(false);
    // Reset will happen via useEffect
  };

  return (
    <div className="gamePageContainer">
      {/* Navigation */}
      <nav className="gameNav">
        <a href="/" className="gameNavBack">
          <span className="navBackIcon">←</span>
          <span>Back to Generator</span>
        </a>
        <div className="gameNavCenter">
          <span className="gameNavBrand">⚡ Dynamic Physics Lab</span>
        </div>
        <div className="gameNavStatus">
          <span className={`simStatus ${isPaused ? "paused" : "running"}`}>
            {isPaused ? "⏸ Paused" : "▶ Running"}
          </span>
        </div>
      </nav>

      {/* Game Tabs */}
      {games.length > 1 && (
        <div className="conceptSelector">
          <div className="conceptSelectorInner">
            {games.map((game, i) => (
              <button
                key={i}
                type="button"
                className={`conceptSelectorTab ${i === activeIndex ? "active" : ""}`}
                onClick={() => switchGame(i)}
              >
                <span className="conceptTabNum">{i + 1}</span>
                <span className="conceptTabTitle">{game.title}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="gameMainArea" ref={containerRef}>
        {/* Canvas Section */}
        <div className="gameCanvasSection">
          <div className="canvasHeader">
            <div className="canvasHeaderLeft">
              <span className="canvasModeIcon">🎮</span>
              <div>
                <h1 className="canvasTitle">{activeSpec.title}</h1>
                <p className="canvasSubtitle">{activeSpec.objective}</p>
              </div>
            </div>
            <div className="canvasHeaderRight">
              {stateRef.current?.won && (
                <div className="resultBadge success">🎉 Complete!</div>
              )}
              {stateRef.current?.lost && (
                <div className="resultBadge">Game Over</div>
              )}
            </div>
          </div>

          <div className="canvasWrapper">
            <canvas ref={canvasRef} className="physicsCanvas" />
          </div>

          <div className="canvasInfo">
            <p className="canvasDescription">{activeSpec.description}</p>
            <div className="canvasStats">
              <span className="statItem">
                <span className="statLabel">Entities</span>
                <span className="statValue">{activeSpec.entities.length}</span>
              </span>
              <span className="statItem">
                <span className="statLabel">Time</span>
                <span className="statValue">
                  {stateRef.current?.elapsed.toFixed(1) ?? "0.0"}s
                </span>
              </span>
              {activeSpec.ui.showScore && (
                <span className="statItem">
                  <span className="statLabel">Score</span>
                  <span className="statValue">{stateRef.current?.score ?? 0}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Controls Section */}
        <aside className="gameControlsSection">
          {/* Quick Actions */}
          <div className="controlCard actionCard">
            <div className="actionButtons">
              <button
                className={`actionBtn ${isPaused ? "play" : "pause"}`}
                type="button"
                onClick={() => setIsPaused((p) => !p)}
              >
                {isPaused ? "▶ Play" : "⏸ Pause"}
              </button>
              <button
                className="actionBtn reset"
                type="button"
                onClick={resetSimulation}
              >
                ↻ Reset
              </button>
            </div>
          </div>

          {/* Dynamic Controls */}
          {activeSpec.controls.length > 0 && (
            <div className="controlCard">
              <div className="controlCardHeader">
                <span className="controlCardIcon">🎛️</span>
                <h3>Parameters</h3>
              </div>
              <div className="sliderGroup">
                {activeSpec.controls.map((ctrl) => (
                  <div key={ctrl.id} className="sliderRow">
                    <label htmlFor={ctrl.id}>{ctrl.label}</label>
                    {ctrl.type === "slider" && (
                      <>
                        <input
                          id={ctrl.id}
                          type="range"
                          min={ctrl.min ?? 0}
                          max={ctrl.max ?? 100}
                          step={ctrl.step ?? 1}
                          value={controlValues[ctrl.id] as number ?? ctrl.default ?? 0}
                          onChange={(e) =>
                            handleControlChange(ctrl.id, Number(e.target.value))
                          }
                        />
                        <span className="sliderValue">
                          {(controlValues[ctrl.id] as number ?? ctrl.default ?? 0).toFixed(
                            ctrl.step && ctrl.step < 1 ? 2 : 0
                          )}
                        </span>
                      </>
                    )}
                    {ctrl.type === "toggle" && (
                      <input
                        id={ctrl.id}
                        type="checkbox"
                        checked={controlValues[ctrl.id] as boolean ?? false}
                        onChange={(e) =>
                          handleControlChange(ctrl.id, e.target.checked)
                        }
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Equations */}
          {activeSpec.learning.equations.length > 0 && (
            <div className="controlCard equationsCard">
              <div className="controlCardHeader">
                <span className="controlCardIcon">📐</span>
                <h3>Equations</h3>
              </div>
              {activeSpec.learning.equations.map((eq, i) => (
                <div key={i} className="equationDisplay">
                  <div className="equationFormulaBig">{eq.formula}</div>
                  <p className="equationDesc">{eq.explanation}</p>
                  <div className="variableTags">
                    {eq.variables.map((v, j) => (
                      <span key={j} className="varTag">{v}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Learning Tips */}
          {activeSpec.learning.tips.length > 0 && (
            <div className="controlCard learningCard">
              <div className="controlCardHeader">
                <span className="controlCardIcon">💡</span>
                <h3>Tips</h3>
              </div>
              <ul className="tipsList">
                {activeSpec.learning.tips.map((tip, i) => (
                  <li key={i}>{tip}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Entities List */}
          <div className="controlCard">
            <div className="controlCardHeader">
              <span className="controlCardIcon">🎯</span>
              <h3>Objects</h3>
            </div>
            <div className="entitiesList">
              {activeSpec.entities.map((entity) => (
                <div key={entity.id} className="entityItem">
                  <span
                    className="entityColor"
                    style={{ background: entity.color }}
                  />
                  <span className="entityName">
                    {entity.label ?? entity.id}
                  </span>
                  <span className="entityType">{entity.shape}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
