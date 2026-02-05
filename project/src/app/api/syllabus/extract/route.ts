import { NextResponse } from "next/server";
import { runSyllabusExtractionPipeline } from "@/lib/syllabusPipeline";

export const runtime = "nodejs";

function decodePdfLiteral(value: string): string {
  return value
    .replace(/\\([nrtbf()\\])/g, (_, token: string) => {
      const map: Record<string, string> = {
        n: "\n",
        r: "\r",
        t: "\t",
        b: "\b",
        f: "\f",
        "(": "(",
        ")": ")",
        "\\": "\\",
      };
      return map[token] ?? token;
    })
    .replace(/\\([0-7]{1,3})/g, (_, octal: string) =>
      String.fromCharCode(parseInt(octal, 8)),
    )
    .replace(/\\\r?\n/g, "");
}

function extractTextFromPdf(buffer: ArrayBuffer): string {
  const raw = Buffer.from(buffer).toString("latin1");

  const literalMatches = [...raw.matchAll(/\(([^()]*)\)/g)].map((match) =>
    decodePdfLiteral(match[1]),
  );

  const literalText = literalMatches.join(" ").replace(/\s+/g, " ").trim();
  if (literalText.length > 120) {
    return literalText;
  }

  const asciiChunks = raw.match(/[A-Za-z][A-Za-z0-9 ,.;:'"!?()/\\-]{24,}/g) ?? [];
  return asciiChunks.join(" ").replace(/\s+/g, " ").trim();
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "No syllabus file found in request." },
      { status: 400 },
    );
  }

  const fileName = file.name || "uploaded-syllabus";
  const isPdf =
    file.type === "application/pdf" || fileName.toLowerCase().endsWith(".pdf");

  let rawText = "";
  if (isPdf) {
    rawText = extractTextFromPdf(await file.arrayBuffer());
  } else {
    rawText = await file.text();
  }

  if (!rawText.trim()) {
    return NextResponse.json(
      {
        error:
          "Could not extract readable text from the uploaded file. Try a text or markdown syllabus.",
      },
      { status: 422 },
    );
  }

  const result = runSyllabusExtractionPipeline(fileName, rawText);
  return NextResponse.json(result);
}

