This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## LLM Selector

This project includes an LLM selector UI at `/llm-selector` where you can:

- Select from a list of LLM models/providers.
- Send a prompt to `/api/llm`.
- Make a live OpenAI request when an OpenAI model is selected.

To enable live OpenAI calls, set:

```bash
OPENAI_API_KEY=your_key_here
```

Without the key, non-OpenAI options still work with mock responses.

## Game Physics Backend Tool

This project now includes a deterministic game physics backend exposed as:

- `POST /api/game-physics`

The endpoint accepts a physics world state and optional actions, then returns
the updated world and collision events. It is designed to be called as a
backend tool by game-generation or playtest agents.

Request shape:

```json
{
  "world": {
    "tick": 0,
    "elapsedMs": 0,
    "gravity": { "x": 0, "y": 14 },
    "bounds": {
      "min": { "x": 0, "y": 0 },
      "max": { "x": 100, "y": 60 }
    },
    "bodies": [
      {
        "id": "player",
        "position": { "x": 20, "y": 10 },
        "velocity": { "x": 0, "y": 0 },
        "halfSize": { "x": 1, "y": 1.5 },
        "mass": 1
      }
    ]
  },
  "actions": [
    {
      "type": "applyImpulse",
      "bodyId": "player",
      "impulse": { "x": 3.5, "y": -6.5 }
    }
  ],
  "dtMs": 16.667,
  "steps": 1
}
```

Supported actions:

- `applyImpulse`
- `applyForce`
- `setVelocity`
- `teleport`
- `spawnBody`
- `removeBody`

Server-side reusable entrypoint:

- `src/lib/game-physics/tool.ts` -> `runGamePhysicsTool(payload)`
- `src/lib/game-physics/engine.ts` -> `runPhysicsSimulation(request)`

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `src/app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
