import { runUiTestAgent } from "@/agents/playtesting/uiTestAgent";

type UiTestBody = {
  baseUrl?: string;
  paths?: string[];
  timeoutMs?: number;
};

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as UiTestBody | null;
  const baseUrl = body?.baseUrl?.trim() || "http://localhost:3000";

  if (!isHttpUrl(baseUrl)) {
    return Response.json(
      {
        ok: false,
        error: "Invalid baseUrl. Use a full URL like http://localhost:3000",
      },
      { status: 400 },
    );
  }

  const report = await runUiTestAgent({
    baseUrl,
    paths: body?.paths,
    timeoutMs: body?.timeoutMs,
  });

  return Response.json({
    ok: true,
    step: "ui-test",
    message:
      report.summary.totalIssues === 0
        ? "UI test pass: no issues detected."
        : `UI test complete: ${report.summary.totalIssues} issue(s) found.`,
    report,
  });
}
