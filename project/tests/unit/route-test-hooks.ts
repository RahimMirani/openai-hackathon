import Module from "node:module";
import path from "node:path";

type InternalModule = typeof Module & {
  _load: (...args: unknown[]) => unknown;
  _resolveFilename: (...args: unknown[]) => unknown;
};

let activeMocks: Record<string, unknown> | undefined;

export function installRouteTestHooks(): () => void {
  const internal = Module as InternalModule;
  const originalLoad = internal._load;
  const originalResolveFilename = internal._resolveFilename;

  internal._resolveFilename = function resolveWithAlias(
    request: unknown,
    parent: unknown,
    isMain: unknown,
    options: unknown,
  ): unknown {
    if (typeof request === "string" && request.startsWith("@/")) {
      const resolved = path.join(
        process.cwd(),
        "tests",
        "dist",
        "src",
        request.slice(2),
      );
      return originalResolveFilename.call(this, resolved, parent, isMain, options);
    }

    return originalResolveFilename.call(this, request, parent, isMain, options);
  };

  internal._load = function loadWithNextServerMock(
    request: unknown,
    parent: unknown,
    isMain: unknown,
  ): unknown {
    if (typeof request === "string" && activeMocks && request in activeMocks) {
      return activeMocks[request];
    }

    if (request === "next/server") {
      return {
        NextResponse: {
          json(payload: unknown, init?: { status?: number }): Response {
            return new Response(JSON.stringify(payload), {
              status: init?.status ?? 200,
              headers: { "content-type": "application/json" },
            });
          },
        },
      };
    }

    return originalLoad.call(this, request, parent, isMain);
  };

  return () => {
    internal._load = originalLoad;
    internal._resolveFilename = originalResolveFilename;
    activeMocks = undefined;
  };
}

export function installRouteTestHooksWithMocks(
  mocks: Record<string, unknown>,
): () => void {
  activeMocks = mocks;
  return installRouteTestHooks();
}
