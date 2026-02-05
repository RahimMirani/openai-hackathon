import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import {
  installRouteTestHooks,
  installRouteTestHooksWithMocks,
} from "./route-test-hooks";

const testRequire = createRequire(__filename);

function loadLlmRoute(): { POST: (request: Request) => Promise<Response> } {
  const modulePath = testRequire.resolve("../../src/app/api/llm/route");
  delete testRequire.cache[modulePath];
  return testRequire(modulePath) as { POST: (request: Request) => Promise<Response> };
}

test("POST /api/llm validates required fields", async () => {
  const restoreHooks = installRouteTestHooks();

  try {
    const { POST } = loadLlmRoute();

    const request = new Request("http://localhost/api/llm", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ provider: "openai", model: "gpt-4.1-mini" }),
    });

    const response = await POST(request);
    const payload = (await response.json()) as { error: string };

    assert.equal(response.status, 400);
    assert.match(payload.error, /provider, model, and prompt are required\./i);
  } finally {
    restoreHooks();
  }
});

test("POST /api/llm returns mock output for non-openai providers", async () => {
  const restoreHooks = installRouteTestHooks();

  try {
    const { POST } = loadLlmRoute();

    const request = new Request("http://localhost/api/llm", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        provider: "anthropic",
        model: "claude-3-5-sonnet-latest",
        prompt: "test prompt",
      }),
    });

    const response = await POST(request);
    const payload = (await response.json()) as {
      live: boolean;
      provider: string;
      model: string;
      output: string;
    };

    assert.equal(response.status, 200);
    assert.equal(payload.live, false);
    assert.equal(payload.provider, "anthropic");
    assert.equal(payload.model, "claude-3-5-sonnet-latest");
    assert.match(payload.output, /mock response/i);
  } finally {
    restoreHooks();
  }
});

test("POST /api/llm returns live output for openai provider when fetch succeeds", async () => {
  const restoreHooks = installRouteTestHooksWithMocks({
    "@/lib/env": {
      getServerEnv: () => "test-api-key",
    },
  });
  const originalFetch = globalThis.fetch;

  try {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ output_text: "Hello from OpenAI" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })) as typeof fetch;

    const { POST } = loadLlmRoute();

    const request = new Request("http://localhost/api/llm", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        provider: "openai",
        model: "gpt-4.1-mini",
        prompt: "Say hi",
      }),
    });

    const response = await POST(request);
    const payload = (await response.json()) as {
      live: boolean;
      provider: string;
      model: string;
      output: string;
    };

    assert.equal(response.status, 200);
    assert.equal(payload.live, true);
    assert.equal(payload.provider, "openai");
    assert.equal(payload.model, "gpt-4.1-mini");
    assert.equal(payload.output, "Hello from OpenAI");
  } finally {
    globalThis.fetch = originalFetch;
    restoreHooks();
  }
});

test("POST /api/llm returns 500 for openai provider when API key is missing", async () => {
  const restoreHooks = installRouteTestHooksWithMocks({
    "@/lib/env": {
      getServerEnv: () => undefined,
    },
  });

  try {
    const { POST } = loadLlmRoute();

    const request = new Request("http://localhost/api/llm", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        provider: "openai",
        model: "gpt-4.1-mini",
        prompt: "Say hi",
      }),
    });

    const response = await POST(request);
    const payload = (await response.json()) as { error: string };

    assert.equal(response.status, 500);
    assert.match(payload.error, /openai_api_key is missing/i);
  } finally {
    restoreHooks();
  }
});
