export type UiIssueSeverity = "high" | "medium" | "low";

export type UiIssue = {
  severity: UiIssueSeverity;
  code: string;
  message: string;
  fix: string;
};

export type UiPageReport = {
  url: string;
  ok: boolean;
  status: number | null;
  issues: UiIssue[];
};

export type UiTestRequest = {
  baseUrl: string;
  paths?: string[];
  timeoutMs?: number;
};

export type UiTestReport = {
  target: string;
  generatedAt: string;
  pages: UiPageReport[];
  summary: {
    totalPages: number;
    totalIssues: number;
    high: number;
    medium: number;
    low: number;
  };
  nextActions: string[];
};

const DEFAULT_TIMEOUT_MS = 6_000;

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, "");
}

function normalizePaths(paths: string[] | undefined): string[] {
  if (!paths || paths.length === 0) {
    return ["/"];
  }
  return paths.map((path) => {
    const trimmed = path.trim();
    if (!trimmed) {
      return "/";
    }
    return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  });
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function extractAttr(tag: string, attr: string): string | null {
  const re = new RegExp(`${attr}\\s*=\\s*["']([^"']*)["']`, "i");
  const match = tag.match(re);
  return match ? match[1] : null;
}

function analyzeHtml(html: string): UiIssue[] {
  const issues: UiIssue[] = [];

  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!titleMatch || !titleMatch[1].trim()) {
    issues.push({
      severity: "high",
      code: "missing-title",
      message: "Page does not define a usable <title>.",
      fix: "Add a unique, descriptive <title> for this route.",
    });
  }

  if (!/<meta[^>]*name=["']viewport["'][^>]*>/i.test(html)) {
    issues.push({
      severity: "medium",
      code: "missing-viewport",
      message: "Viewport meta tag is missing, which can break mobile rendering.",
      fix: 'Add <meta name="viewport" content="width=device-width, initial-scale=1" />.',
    });
  }

  if (!/<main[\s>]/i.test(html)) {
    issues.push({
      severity: "medium",
      code: "missing-main",
      message: "No <main> landmark found for primary page content.",
      fix: "Wrap core page content inside a single <main> element.",
    });
  }

  const h1Count = (html.match(/<h1[\s>]/gi) ?? []).length;
  if (h1Count === 0) {
    issues.push({
      severity: "medium",
      code: "missing-h1",
      message: "No <h1> found on page.",
      fix: "Add one visible <h1> that describes the page purpose.",
    });
  } else if (h1Count > 1) {
    issues.push({
      severity: "low",
      code: "multiple-h1",
      message: "Multiple <h1> elements found.",
      fix: "Keep a single primary <h1> and downgrade the others to <h2>/<h3>.",
    });
  }

  const imgTags = html.match(/<img\b[^>]*>/gi) ?? [];
  const missingAltCount = imgTags.filter((tag) => {
    const alt = extractAttr(tag, "alt");
    return alt === null || alt.trim() === "";
  }).length;
  if (missingAltCount > 0) {
    issues.push({
      severity: "high",
      code: "image-alt",
      message: `${missingAltCount} image(s) are missing meaningful alt text.`,
      fix: "Add alt text for informative images, or alt=\"\" for decorative images.",
    });
  }

  const labelForIds = new Set<string>();
  const labelRegex = /<label\b[^>]*for=["']([^"']+)["'][^>]*>/gi;
  let labelMatch: RegExpExecArray | null = labelRegex.exec(html);
  while (labelMatch) {
    labelForIds.add(labelMatch[1]);
    labelMatch = labelRegex.exec(html);
  }

  const inputTags = html.match(/<(input|textarea|select)\b[^>]*>/gi) ?? [];
  let unlabeledInputs = 0;
  for (const tag of inputTags) {
    const isHiddenInput = /^<input\b/i.test(tag) && /type=["']hidden["']/i.test(tag);
    if (isHiddenInput) {
      continue;
    }

    const id = extractAttr(tag, "id");
    const hasAriaLabel =
      (extractAttr(tag, "aria-label") ?? "").trim().length > 0 ||
      (extractAttr(tag, "aria-labelledby") ?? "").trim().length > 0;
    const hasAssociatedLabel = Boolean(id && labelForIds.has(id));
    if (!hasAriaLabel && !hasAssociatedLabel) {
      unlabeledInputs += 1;
    }
  }

  if (unlabeledInputs > 0) {
    issues.push({
      severity: "high",
      code: "form-labels",
      message: `${unlabeledInputs} form control(s) are missing labels.`,
      fix: "Add <label htmlFor=...> or aria-label/aria-labelledby to each control.",
    });
  }

  const buttonRegex = /<button\b([^>]*)>([\s\S]*?)<\/button>/gi;
  let buttonMatch: RegExpExecArray | null = buttonRegex.exec(html);
  let unnamedButtons = 0;
  while (buttonMatch) {
    const attrs = buttonMatch[1] ?? "";
    const body = stripTags(buttonMatch[2] ?? "");
    const hasAriaName =
      /aria-label=["'][^"']+["']/i.test(attrs) || /aria-labelledby=["'][^"']+["']/i.test(attrs);
    const hasVisibleName = body.length > 0;
    if (!hasAriaName && !hasVisibleName) {
      unnamedButtons += 1;
    }
    buttonMatch = buttonRegex.exec(html);
  }

  if (unnamedButtons > 0) {
    issues.push({
      severity: "medium",
      code: "button-name",
      message: `${unnamedButtons} button(s) have no accessible name.`,
      fix: "Add visible button text or an aria-label for icon-only buttons.",
    });
  }

  const genericLinkWords = new Set(["click here", "read more", "learn more", "more"]);
  const linkRegex = /<a\b[^>]*>([\s\S]*?)<\/a>/gi;
  let linkMatch: RegExpExecArray | null = linkRegex.exec(html);
  let genericLinks = 0;
  while (linkMatch) {
    const text = stripTags(linkMatch[1] ?? "").toLowerCase();
    if (genericLinkWords.has(text)) {
      genericLinks += 1;
    }
    linkMatch = linkRegex.exec(html);
  }

  if (genericLinks > 0) {
    issues.push({
      severity: "low",
      code: "generic-link-text",
      message: `${genericLinks} link(s) use generic anchor text.`,
      fix: "Use specific link text that describes the destination or action.",
    });
  }

  return issues;
}

function buildNextActions(report: UiTestReport): string[] {
  if (report.summary.totalIssues === 0) {
    return ["No blockers detected. Re-run after major UI changes."];
  }

  const actions: string[] = [];
  if (report.summary.high > 0) {
    actions.push("Fix all high-severity accessibility findings first.");
  }
  if (report.summary.medium > 0) {
    actions.push("Address structure and naming issues affecting usability.");
  }
  if (report.summary.low > 0) {
    actions.push("Clean up low-severity content quality issues.");
  }
  actions.push("Re-run the UI agent to confirm issue count is reduced to zero.");
  return actions;
}

export async function runUiTestAgent(input: UiTestRequest): Promise<UiTestReport> {
  const baseUrl = normalizeBaseUrl(input.baseUrl);
  const paths = normalizePaths(input.paths);
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const pages: UiPageReport[] = [];
  for (const path of paths) {
    const url = `${baseUrl}${path}`;
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
      const contentType = response.headers.get("content-type") ?? "";
      const report: UiPageReport = {
        url,
        ok: response.ok,
        status: response.status,
        issues: [],
      };

      if (!response.ok) {
        report.issues.push({
          severity: "high",
          code: "http-error",
          message: `Page returned HTTP ${response.status}.`,
          fix: "Resolve route/server errors and confirm the page returns HTTP 200.",
        });
      } else if (!contentType.includes("text/html")) {
        report.issues.push({
          severity: "medium",
          code: "non-html-response",
          message: `Expected HTML response but got "${contentType || "unknown"}".`,
          fix: "Target an HTML route for UI testing (not an API/file endpoint).",
        });
      } else {
        const html = await response.text();
        report.issues = analyzeHtml(html);
      }

      pages.push(report);
    } catch (error) {
      pages.push({
        url,
        ok: false,
        status: null,
        issues: [
          {
            severity: "high",
            code: "connection-failed",
            message:
              error instanceof Error
                ? `Could not reach page: ${error.message}`
                : "Could not reach page.",
            fix: "Start the local server and confirm the URL/port are correct.",
          },
        ],
      });
    }
  }

  const allIssues = pages.flatMap((page) => page.issues);
  const summary = {
    totalPages: pages.length,
    totalIssues: allIssues.length,
    high: allIssues.filter((issue) => issue.severity === "high").length,
    medium: allIssues.filter((issue) => issue.severity === "medium").length,
    low: allIssues.filter((issue) => issue.severity === "low").length,
  };

  const report: UiTestReport = {
    target: baseUrl,
    generatedAt: new Date().toISOString(),
    pages,
    summary,
    nextActions: [],
  };
  report.nextActions = buildNextActions(report);
  return report;
}
