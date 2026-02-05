"use client";

import { useEffect, useState } from "react";
import GameCanvas from "@/components/GameCanvas";
import DynamicGameCanvas from "@/components/DynamicGameCanvas";

export default function GamePage() {
  const [useDynamic, setUseDynamic] = useState(false);

  useEffect(() => {
    // Check if we have a dynamic game spec stored
    const dynamicSpec = localStorage.getItem("age.gameSpec");
    const dynamicGames = localStorage.getItem("age.dynamicGames");
    
    if (dynamicSpec || dynamicGames) {
      try {
        const spec = dynamicSpec ? JSON.parse(dynamicSpec) : null;
        const games = dynamicGames ? JSON.parse(dynamicGames) : null;
        
        // Check if it's a new-style GameSpec (has entities array)
        if (spec?.entities || (games?.[0]?.gameSpec?.entities)) {
          setUseDynamic(true);
        }
      } catch {
        // Fall back to legacy
      }
    }
  }, []);

  return (
    <main className="gamePage">
      {useDynamic ? <DynamicGameCanvas /> : <GameCanvas />}
    </main>
  );
}
