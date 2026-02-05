"use client";

import type { ChangeEvent } from "react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { DemoOption, SyllabusExtractionResult } from "@/lib/syllabusPipeline";

type PipelineStep = "design" | "build" | "playtest" | "fix";
type UploadState = "idle" | "running" | "done" | "error";

type RunLog = {
  id: string;
  step: PipelineStep;
  status: "queued" | "running" | "ok" | "error";
  message: string;
  timestamp: string;
};

type ChatMessage = {
  id: string;
  role: "system" | "user" | "assistant";
  text: string;
};

const stepLabels: Record<PipelineStep, string> = {
  design: "Design",
  build: "Build",
  playtest: "Playtest",
  fix: "Fix",
};

const orderedSteps: PipelineStep[] = ["design", "build", "playtest", "fix"];

const initialMessages: ChatMessage[] = [
  {
    id: "m1",
    role: "system",
    text: 'Welcome. Try: "Build a dodge game with 3 lives and increasing speed."',
  },
  {
    id: "m2",
    role: "user",
    text: "I want a physics-based runner with simple obstacles and a 90-second timer.",
  },
  {
    id: "m3",
    role: "assistant",
    text: "Got it. I'll draft mechanics, constraints, and success conditions.",
  },
];

function buildPromptFromOption(
  option: DemoOption | null,
  keyConcepts: string[] = [],
): string {
  if (!option) {
    return "";
  }

  const concepts = keyConcepts.slice(0, 4).join(", ");
  const conceptsLine = concepts ? ` Key concepts: ${concepts}.` : "";
  return `${option.title}. ${option.gameplayLoop} Win condition: ${option.winCondition} Fail condition: ${option.failCondition}.${conceptsLine}`;
}

export default function ChatLanding() {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [logs, setLogs] = useState<RunLog[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);

  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<SyllabusExtractionResult | null>(null);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);

  const placeholderHint = useMemo(() => {
    if (selectedFile) {
      return `Attached: ${selectedFile.name}`;
    }
    return "Describe the game you want to generate...";
  }, [selectedFile]);

  const selectedOption = useMemo(() => {
    return analysis?.options.find((option) => option.id === selectedOptionId) ?? null;
  }, [analysis?.options, selectedOptionId]);

  const appendLog = (entry: Omit<RunLog, "id" | "timestamp">) => {
    const timestamp = new Date().toLocaleTimeString();
    const id = `${entry.step}-${Date.now()}-${Math.random()}`;
    setLogs((prev) => [
      {
        ...entry,
        id,
        timestamp,
      },
      ...prev,
    ]);
  };

  const runStep = async (
    step: PipelineStep,
    payload: {
      prompt: string;
      fileName: string | null;
      plan?: Record<string, unknown>;
      issues?: string[];
    },
  ) => {
    appendLog({
      step,
      status: "running",
      message: `Running ${stepLabels[step]} agent...`,
    });

    try {
      const response = await fetch(`/api/${step}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Request failed");
      }

      const data = (await response.json()) as {
        message?: string;
        config?: Record<string, unknown>;
      };
      appendLog({
        step,
        status: "ok",
        message: data.message ?? `${stepLabels[step]} complete.`,
      });
      return data;
    } catch {
      appendLog({
        step,
        status: "error",
        message: `${stepLabels[step]} failed. Try again.`,
      });
      return null;
    }
  };

  const runPipeline = async (options?: { navigate?: boolean; promptOverride?: string }) => {
    if (isRunning) {
      return;
    }

    const selectedPrompt = buildPromptFromOption(selectedOption, analysis?.keyConcepts);
    const prompt = (options?.promptOverride ?? input.trim()) || selectedPrompt;
    const basePayload = { prompt, fileName: selectedFile?.name ?? null };
    setIsRunning(true);

    let plan: Record<string, unknown> | null = null;
    let issues: string[] = [];
    let gameConfig: Record<string, unknown> | null = null;

    for (const step of orderedSteps) {
      const payload =
        step === "build" && plan
          ? { ...basePayload, plan }
          : step === "fix"
            ? { ...basePayload, issues }
            : basePayload;

      const data = await runStep(step, payload);
      if (!data) {
        break;
      }

      if (step === "build" && data.config) {
        gameConfig = data.config;
      }
      if (step === "design" && "plan" in data) {
        plan = (data as { plan?: Record<string, unknown> }).plan ?? null;
      }
      if (step === "playtest" && "issues" in data) {
        issues = (data as { issues?: string[] }).issues ?? [];
      }
    }

    setIsRunning(false);
    if (options?.navigate && gameConfig) {
      localStorage.setItem("age.gameConfig", JSON.stringify(gameConfig));
      router.push("/game");
    }
  };

  const runSyllabusExtraction = async (
    fileOverride?: File,
  ): Promise<SyllabusExtractionResult | null> => {
    const targetFile = fileOverride ?? selectedFile;
    if (!targetFile) {
      setUploadError("Select a syllabus file before running the extraction pipeline.");
      setUploadState("error");
      return null;
    }

    setUploadError(null);
    setUploadState("running");

    try {
      const formData = new FormData();
      formData.append("file", targetFile);

      const response = await fetch("/api/syllabus/extract", {
        method: "POST",
        body: formData,
      });

      const data: SyllabusExtractionResult | { error: string } = await response.json();
      if (!response.ok || "error" in data) {
        throw new Error("error" in data ? data.error : "Pipeline failed.");
      }

      const preferredOption =
        data.options.find((option) => option.id === data.recommendedOptionId) ??
        data.options[0] ??
        null;
      setAnalysis(data);
      setSelectedOptionId(preferredOption?.id ?? null);
      if (!input.trim()) {
        setInput(buildPromptFromOption(preferredOption, data.keyConcepts));
      }
      setUploadState("done");
      return data;
    } catch (error) {
      setUploadState("error");
      setUploadError(error instanceof Error ? error.message : "Pipeline failed.");
      return null;
    }
  };

  const handleRunSyllabus = async () => {
    const result = await runSyllabusExtraction();
    if (!result) {
      return;
    }

    const preferredOption =
      result.options.find((option) => option.id === result.recommendedOptionId) ??
      result.options[0] ??
      null;
    const promptOverride = buildPromptFromOption(preferredOption, result.keyConcepts);
    await runPipeline({ navigate: false, promptOverride });
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    if (file) {
      await runSyllabusExtraction(file);
    }
  };

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isRunning) {
      return;
    }

    const now = Date.now();
    setMessages((prev) => [
      ...prev,
      { id: `m-${now}`, role: "user", text: trimmed },
      {
        id: `m-${now}-a`,
        role: "assistant",
        text: "Starting the pipeline and preparing the canvas...",
      },
    ]);

    setInput("");
    await runPipeline({ navigate: true, promptOverride: trimmed });
  };

  const handleCreateFromOption = async (option: DemoOption) => {
    if (isRunning) {
      return;
    }

    const promptOverride = buildPromptFromOption(option, analysis?.keyConcepts);
    setSelectedOptionId(option.id);
    setInput(promptOverride);
    await runPipeline({ navigate: true, promptOverride });
  };

  function renderOptionCard(option: DemoOption) {
    const isSelected = selectedOptionId === option.id;
    return (
      <div key={option.id} className="optionCardWrap">
        <button
          className={`optionCard${isSelected ? " selected" : ""}`}
          onClick={() => {
            setSelectedOptionId(option.id);
            setInput(buildPromptFromOption(option, analysis?.keyConcepts));
          }}
          type="button"
        >
          <p className="optionTitle">{option.title}</p>
          <p className="optionLoop">{option.gameplayLoop}</p>
        </button>
        <button
          className="optionCreateButton"
          type="button"
          onClick={() => {
            void handleCreateFromOption(option);
          }}
          disabled={isRunning}
        >
          Create
        </button>
      </div>
    );
  }

  return (
    <main className="page">
      <div className="shell">
        <header className="topbar">
          <div className="brand">
            <span className="brandDot" />
            <div>
              <p className="brandTitle">Autonomous Game Engineer</p>
              <p className="brandMeta">Codex-powered game systems</p>
            </div>
          </div>
          <div className="topbarActions">
            <span className="statusPill">Live Demo</span>
            <button className="ghostButton" type="button">
              New Session
            </button>
          </div>
        </header>

        <section className="hero">
          <p className="eyebrow">Chat-first game creation</p>
          <h1>Design a playable system through conversation.</h1>
          <p className="lede">
            Describe mechanics, constraints, and win conditions, or upload a syllabus to derive
            the game structure.
          </p>
        </section>

        <section className="grid">
          <div className="panel chatPanel">
            <div className="panelHeader">
              <div>
                <h2>Session</h2>
                <p>Draft your spec in chat, then trigger the pipeline.</p>
              </div>
              <div className="pill">Spec Builder</div>
            </div>

            <div className="chatWindow">
              <div className="messages">
                {messages.map((message) => (
                  <div key={message.id} className={`message ${message.role}`}>
                    <p>{message.text}</p>
                  </div>
                ))}
              </div>
              <div className="inputRow">
                <input
                  className="input"
                  placeholder={placeholderHint}
                  type="text"
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      void handleSend();
                    }
                  }}
                />
                <button
                  className="sendButton"
                  type="button"
                  onClick={() => {
                    void handleSend();
                  }}
                  disabled={isRunning || !input.trim()}
                >
                  Send
                </button>
              </div>
            </div>
          </div>

          <aside className="panel sidePanel">
            <div className="panelHeader">
              <div>
                <h2>Syllabus Upload</h2>
                <p>Optional input to seed mechanics and progression.</p>
              </div>
            </div>

            <div className="uploadCard">
              <div className="uploadZone">
                <input
                  className="fileInput"
                  id="syllabus-file"
                  type="file"
                  accept=".pdf,.md,.txt,.doc,.docx"
                  onChange={(event) => {
                    void handleFileChange(event);
                  }}
                />
                <label className="uploadButton" htmlFor="syllabus-file">
                  Upload Syllabus
                </label>
                <p className="uploadHint">
                  {selectedFile ? selectedFile.name : "PDF, Markdown, or text."}
                </p>
              </div>
              <div className="uploadMeta">
                <p className="metaTitle">What happens next</p>
                <ul className="metaList">
                  <li>Extract key concepts</li>
                  <li>Map concepts to mechanics</li>
                  <li>Generate a playable system</li>
                </ul>
                <p className="statusText">
                  Status:{" "}
                  {uploadState === "running"
                    ? "Running extraction pipeline..."
                    : uploadState === "done"
                      ? "Ready"
                      : uploadState === "error"
                        ? "Failed"
                        : "Idle"}
                </p>
                {uploadError ? <p className="errorText">{uploadError}</p> : null}
              </div>
            </div>

            <div className="pipeline">
              <p className="metaTitle">Pipeline Steps</p>
              <div className="stepGrid">
                {orderedSteps.map((step) => (
                  <button
                    key={step}
                    className="stepCard"
                    type="button"
                    onClick={() =>
                      void runStep(step, {
                        prompt: input.trim(),
                        fileName: selectedFile?.name ?? null,
                      })
                    }
                    disabled={isRunning}
                  >
                    {stepLabels[step]}
                  </button>
                ))}
              </div>
              <button
                className="primaryButton"
                type="button"
                onClick={() => {
                  void runPipeline({ navigate: false });
                }}
                disabled={isRunning}
              >
                {isRunning ? "Running..." : "Run Pipeline"}
              </button>
              <button
                className="primaryButton"
                type="button"
                onClick={() => {
                  void handleRunSyllabus();
                }}
                disabled={uploadState === "running"}
              >
                {uploadState === "running" ? "Extracting..." : "Run Syllabus Extraction"}
              </button>
            </div>

            <div className="runLog">
              <p className="metaTitle">Run Log</p>
              <div className="logList">
                {logs.length === 0 ? (
                  <p className="logEmpty">No runs yet. Trigger a step to see activity.</p>
                ) : (
                  logs.map((log) => (
                    <div key={log.id} className={`logItem ${log.status}`}>
                      <div>
                        <p className="logTitle">{stepLabels[log.step]}</p>
                        <p className="logMessage">{log.message}</p>
                      </div>
                      <span className="logTime">{log.timestamp}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {analysis ? (
              <div className="optionPanel">
                <p className="metaTitle">Extracted Mechanics Signal</p>
                <p className="summaryText">{analysis.summary}</p>

                <div className="chips">
                  {analysis.keyConcepts.map((concept) => (
                    <span className="chip" key={concept}>
                      {concept}
                    </span>
                  ))}
                </div>

                <p className="metaTitle">Interactive Demo Options</p>
                <div className="optionGrid">{analysis.options.map(renderOptionCard)}</div>

                {selectedOption ? (
                  <div className="optionDetail">
                    <p className="detailTitle">{selectedOption.title}</p>
                    <p>
                      <strong>Win:</strong> {selectedOption.winCondition}
                    </p>
                    <p>
                      <strong>Fail:</strong> {selectedOption.failCondition}
                    </p>
                    <p>{selectedOption.whyItFits}</p>
                  </div>
                ) : null}
              </div>
            ) : null}
          </aside>
        </section>
      </div>
    </main>
  );
}
