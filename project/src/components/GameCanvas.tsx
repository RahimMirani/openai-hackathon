"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type GameConfig = {
  title: string;
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
  };
  arena: {
    width: number;
    height: number;
    background: string;
  };
  rules: {
    lives: number;
    timer: number;
  };
};

const defaultConfig: GameConfig = {
  title: "Generated Dodge Prototype",
  goal: "Survive until the timer ends.",
  player: {
    speed: 260,
    radius: 14,
    color: "#1f5b57",
  },
  obstacles: {
    count: 6,
    speed: 120,
    radius: 12,
    color: "#b4552d",
  },
  arena: {
    width: 960,
    height: 540,
    background: "#fbfaf7",
  },
  rules: {
    lives: 3,
    timer: 60,
  },
};

const mergeConfig = (incoming: Partial<GameConfig>): GameConfig => ({
  ...defaultConfig,
  ...incoming,
  player: { ...defaultConfig.player, ...incoming.player },
  obstacles: { ...defaultConfig.obstacles, ...incoming.obstacles },
  arena: { ...defaultConfig.arena, ...incoming.arena },
  rules: { ...defaultConfig.rules, ...incoming.rules },
});

type Obstacle = {
  x: number;
  y: number;
  radius: number;
};

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [config, setConfig] = useState<GameConfig>(defaultConfig);
  const [status, setStatus] = useState<"running" | "win" | "lose">("running");

  useEffect(() => {
    const stored = localStorage.getItem("age.gameConfig");
    if (!stored) {
      return;
    }
    try {
      const parsed = JSON.parse(stored) as Partial<GameConfig>;
      setConfig(mergeConfig(parsed));
    } catch {
      setConfig(defaultConfig);
    }
  }, []);

  const title = useMemo(() => config.title, [config.title]);

  useEffect(() => {
    setStatus("running");
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) {
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    let animationId = 0;
    let lastTime = performance.now();
    let lives = config.rules.lives;
    let timeLeft = config.rules.timer;
    let statusState: "running" | "win" | "lose" = "running";

    const player = {
      x: config.arena.width / 2,
      y: config.arena.height - 80,
      vx: 0,
      vy: 0,
    };

    const obstacles: Obstacle[] = Array.from(
      { length: config.obstacles.count },
      (_, index) => ({
        x:
          (config.arena.width / config.obstacles.count) * index +
          config.obstacles.radius * 2,
        y: Math.random() * -config.arena.height,
        radius: config.obstacles.radius,
      })
    );

    const keys = new Set<string>();

    const handleKeyDown = (event: KeyboardEvent) => {
      keys.add(event.key.toLowerCase());
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      keys.delete(event.key.toLowerCase());
    };

    const resize = () => {
      const width = Math.min(config.arena.width, container.clientWidth);
      const height = (width / config.arena.width) * config.arena.height;
      canvas.width = width * window.devicePixelRatio;
      canvas.height = height * window.devicePixelRatio;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
    };

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    const update = (delta: number) => {
      if (statusState !== "running") {
        return;
      }

      timeLeft = Math.max(0, timeLeft - delta);

      const speed = config.player.speed;
      player.vx = 0;
      player.vy = 0;

      if (keys.has("arrowleft") || keys.has("a")) {
        player.vx = -speed;
      }
      if (keys.has("arrowright") || keys.has("d")) {
        player.vx = speed;
      }
      if (keys.has("arrowup") || keys.has("w")) {
        player.vy = -speed;
      }
      if (keys.has("arrowdown") || keys.has("s")) {
        player.vy = speed;
      }

      player.x += player.vx * delta;
      player.y += player.vy * delta;

      player.x = Math.max(
        config.player.radius,
        Math.min(config.arena.width - config.player.radius, player.x)
      );
      player.y = Math.max(
        config.player.radius,
        Math.min(config.arena.height - config.player.radius, player.y)
      );

      for (const obstacle of obstacles) {
        obstacle.y += config.obstacles.speed * delta;
        if (obstacle.y - obstacle.radius > config.arena.height) {
          obstacle.y = -Math.random() * config.arena.height * 0.3;
          obstacle.x =
            config.obstacles.radius +
            Math.random() * (config.arena.width - config.obstacles.radius * 2);
        }

        const dx = obstacle.x - player.x;
        const dy = obstacle.y - player.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < obstacle.radius + config.player.radius) {
          lives -= 1;
          obstacle.y = -config.obstacles.radius * 2;
          if (lives <= 0) {
            statusState = "lose";
            setStatus("lose");
          }
        }
      }

      if (timeLeft <= 0 && statusState === "running") {
        statusState = "win";
        setStatus("win");
      }
    };

    const render = () => {
      ctx.clearRect(0, 0, config.arena.width, config.arena.height);
      ctx.fillStyle = config.arena.background;
      ctx.fillRect(0, 0, config.arena.width, config.arena.height);

      ctx.fillStyle = config.player.color;
      ctx.beginPath();
      ctx.arc(player.x, player.y, config.player.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = config.obstacles.color;
      for (const obstacle of obstacles) {
        ctx.beginPath();
        ctx.arc(obstacle.x, obstacle.y, obstacle.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = "#2c2620";
      ctx.font = "14px \"Instrument Sans\", sans-serif";
      ctx.fillText(`Lives: ${lives}`, 16, 24);
      ctx.fillText(`Time: ${Math.ceil(timeLeft)}`, 16, 44);
    };

    const loop = (time: number) => {
      const delta = Math.min(0.033, (time - lastTime) / 1000);
      lastTime = time;
      update(delta);
      render();
      animationId = requestAnimationFrame(loop);
    };

    animationId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [config]);

  return (
    <div className="gameShell" ref={containerRef}>
      <div className="gameHeader">
        <div>
          <p className="eyebrow">Generated Canvas</p>
          <h1 className="gameTitle">{title}</h1>
          <p className="lede">{config.goal}</p>
        </div>
        <div className={`statusBadge ${status}`}>
          {status === "running" ? "Running" : status === "win" ? "Completed" : "Failed"}
        </div>
      </div>
      <div className="gameCanvasWrap">
        <canvas ref={canvasRef} className="gameCanvas" />
      </div>
      <div className="gameFooter">
        <p>
          Use arrow keys or WASD. This runtime will be replaced by generated
          mechanics soon.
        </p>
      </div>
    </div>
  );
}
