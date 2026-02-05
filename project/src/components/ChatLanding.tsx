"use client";

import type { ChangeEvent } from "react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  mergeConceptNodes,
  type ConceptNode,
} from "@/lib/workflow/concepts";
import {
  mergeDesignPlan,
  mergeGameConfig,
  type DesignPlan,
  type GameConfig,
} from "@/lib/workflow/game-config";
import {
  normalizeSyllabusText,
  type WorkflowSourceType,
} from "@/lib/workflow/input";

type PipelineStep = "design" | "build" | "visualize" | "playtest" | "fix";

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

type AgentTrace = {
  name?: string;
  tools?: string[];
};

type StepResponse = {
  message?: string;
  plan?: Partial<DesignPlan>;
  config?: Partial<GameConfig>;
  issues?: string[];
  concepts?: unknown;
  agent?: AgentTrace;
};

type StepPayload = {
  prompt: string;
  fileName: string | null;
  sourceType: WorkflowSourceType;
  syllabusText: string | null;
  plan?: Partial<DesignPlan> | null;
  config?: Partial<GameConfig> | null;
  issues?: string[];
  conceptNode?: Partial<ConceptNode> | null;
};

type ResolvedInput = {
  concept: string;
  sourceType: WorkflowSourceType;
};

type GeneratedConceptGame = {
  conceptNode: ConceptNode;
  plan: DesignPlan;
  config: GameConfig;
  issues: string[];
};

const STORAGE_CONFIG = "age.gameConfig";
const STORAGE_CONFIGS = "age.gameConfigs";

const stepLabels: Record<PipelineStep, string> = {
  design: "Design",
  build: "Build",
  visualize: "Visualize",
  playtest: "Playtest",
  fix: "Fix",
};

const orderedSteps: PipelineStep[] = [
  "design",
  "build",
  "visualize",
  "playtest",
  "fix",
];

const conceptGameSteps: PipelineStep[] = ["build", "visualize", "playtest", "fix"];

const initialMessages: ChatMessage[] = [
  {
    id: "m1",
    role: "system",
    text: "Paste a prompt or syllabus. I will split it into concepts and generate one mini-game per concept.",
  },
  {
    id: "m2",
    role: "assistant",
    text: "Each generated game includes interactive controls, tutor guidance, and equation annotations.",
  },
];

function truncatePreview(value: string, maxChars = 120): string {
  const trimmed = value.trim();
  if (trimmed.length <= maxChars) {
    return trimmed;
  }

  return `${trimmed.slice(0, maxChars)}...`;
}

function conceptPromptFromNode(node: ConceptNode): string {
  return `${node.title}: ${node.objective}\n${node.focusPrompt}`;
}

function defaultConcepts(source: string): ConceptNode[] {
  return mergeConceptNodes(null, source);
}

function fallbackConceptNode(source: string): ConceptNode {
  return (
    defaultConcepts(source)[0] ?? {
      id: "concept-1",
      title: "Core Concept",
      objective: "Build an interactive concept-focused physics mini-game.",
      focusPrompt:
        "Build an interactive concept-focused physics mini-game with equation annotations.",
      suggestedMode: "gravity",
    }
  );
}

export default function ChatLanding() {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [logs, setLogs] = useState<RunLog[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [sourceType, setSourceType] = useState<WorkflowSourceType>("prompt");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [syllabusText, setSyllabusText] = useState("");
  const [uploadStatus, setUploadStatus] = useState("No syllabus loaded yet.");
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [latestPlan, setLatestPlan] = useState<DesignPlan | null>(null);
  const [latestConfig, setLatestConfig] = useState<GameConfig | null>(null);
  const [latestIssues, setLatestIssues] = useState<string[]>([]);
  const [latestConcepts, setLatestConcepts] = useState<ConceptNode[]>([]);
  const [generatedGames, setGeneratedGames] = useState<GeneratedConceptGame[]>([]);

  const placeholderHint = useMemo(() => {
    if (sourceType === "syllabus") {
      if (selectedFile) {
        return `Using syllabus: ${selectedFile.name}`;
      }
      return "Upload a syllabus, or switch to prompt mode.";
    }

    return "Describe the physics syllabus or concept...";
  }, [selectedFile, sourceType]);

  const canRun = useMemo(() => {
    return Boolean(input.trim()) || Boolean(syllabusText.trim());
  }, [input, syllabusText]);

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

  const resolveInput = (promptOverride?: string): ResolvedInput | null => {
    const promptCandidate = promptOverride?.trim() ?? input.trim();
    const syllabusCandidate = syllabusText.trim();

    if (sourceType === "syllabus" && syllabusCandidate) {
      return {
        concept: syllabusCandidate,
        sourceType: "syllabus",
      };
    }

    if (promptCandidate) {
      return {
        concept: promptCandidate,
        sourceType: "prompt",
      };
    }

    if (syllabusCandidate) {
      return {
        concept: syllabusCandidate,
        sourceType: "syllabus",
      };
    }

    return null;
  };

  const runStep = async (
    step: PipelineStep,
    payload: StepPayload,
    contextLabel?: string,
  ): Promise<StepResponse | null> => {
    appendLog({
      step,
      status: "running",
      message: `${contextLabel ?? "Global"}: running ${stepLabels[step]} agent...`,
    });

    try {
      const response = await fetch(`/api/${step}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await response.json().catch(() => ({}))) as StepResponse & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Request failed");
      }

      const toolsSummary =
        Array.isArray(data.agent?.tools) && data.agent?.tools.length > 0
          ? ` [tools: ${data.agent.tools.join(", ")}]`
          : "";

      appendLog({
        step,
        status: "ok",
        message:
          `${contextLabel ?? "Global"}: ${
            data.message ?? `${stepLabels[step]} complete.`
          }${toolsSummary}`,
      });
      return data;
    } catch (error) {
      appendLog({
        step,
        status: "error",
        message:
          error instanceof Error
            ? `${contextLabel ?? "Global"}: ${stepLabels[step]} failed: ${error.message}`
            : `${contextLabel ?? "Global"}: ${stepLabels[step]} failed.`,
      });
      return null;
    }
  };

  const runPipeline = async (options?: {
    navigate?: boolean;
    promptOverride?: string;
  }): Promise<{ games: GeneratedConceptGame[]; completed: boolean }> => {
    if (isRunning) {
      return { games: generatedGames, completed: false };
    }

    const resolvedInput = resolveInput(options?.promptOverride);
    if (!resolvedInput) {
      return { games: generatedGames, completed: false };
    }

    setIsRunning(true);

    let plan = latestPlan;
    let completed = true;
    const builtGames: GeneratedConceptGame[] = [];

    const basePayload: Omit<StepPayload, "plan" | "config" | "issues" | "conceptNode"> = {
      prompt: resolvedInput.concept,
      fileName: selectedFile?.name ?? null,
      sourceType: resolvedInput.sourceType,
      syllabusText: syllabusText || null,
    };

    const designData = await runStep("design", basePayload, "Curriculum");
    if (!designData) {
      setIsRunning(false);
      return { games: builtGames, completed: false };
    }

    if (designData.plan) {
      plan = mergeDesignPlan(designData.plan, resolvedInput.concept);
    }

    const resolvedConcepts = mergeConceptNodes(
      designData.concepts,
      resolvedInput.concept,
      4,
    );
    setLatestConcepts(resolvedConcepts);

    for (const conceptNode of resolvedConcepts) {
      const conceptLabel = conceptNode.title;
      const conceptPrompt = conceptPromptFromNode(conceptNode);
      const conceptPlan = mergeDesignPlan(
        {
          ...(plan ?? {}),
          title: conceptNode.title,
          concept: conceptNode.objective,
        },
        conceptPrompt,
      );

      let config: GameConfig | null = null;
      let issues: string[] = [];
      let conceptComplete = true;

      for (const step of conceptGameSteps) {
        const payload: StepPayload =
          step === "build"
            ? { ...basePayload, prompt: conceptPrompt, plan: conceptPlan, conceptNode }
            : step === "visualize"
              ? { ...basePayload, prompt: conceptPrompt, config, conceptNode }
              : step === "playtest"
                ? { ...basePayload, prompt: conceptPrompt, config, conceptNode }
                : {
                    ...basePayload,
                    prompt: conceptPrompt,
                    config,
                    issues,
                    conceptNode,
                  };

        const data = await runStep(step, payload, conceptLabel);
        if (!data) {
          conceptComplete = false;
          completed = false;
          break;
        }

        if ((step === "build" || step === "visualize" || step === "fix") && data.config) {
          config = mergeGameConfig({
            ...data.config,
            title: conceptNode.title,
            concept: conceptNode.objective,
          });
        }

        if (step === "playtest") {
          issues = Array.isArray(data.issues)
            ? data.issues.filter((issue): issue is string => typeof issue === "string")
            : [];
        }
      }

      if (conceptComplete && config) {
        builtGames.push({
          conceptNode,
          plan: conceptPlan,
          config,
          issues,
        });
      }
    }

    setLatestPlan(plan);
    setLatestConfig(builtGames[0]?.config ?? latestConfig);
    setLatestIssues(builtGames[0]?.issues ?? []);
    setGeneratedGames(builtGames);
    setIsRunning(false);

    if (options?.navigate && builtGames.length > 0) {
      localStorage.setItem(STORAGE_CONFIG, JSON.stringify(builtGames[0].config));
      localStorage.setItem(STORAGE_CONFIGS, JSON.stringify(builtGames));
      router.push("/game");
    }

    return {
      games: builtGames,
      completed,
    };
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);

    if (!file) {
      setSyllabusText("");
      setUploadStatus("No syllabus loaded yet.");
      return;
    }

    setUploadStatus(`Reading ${file.name}...`);

    try {
      const raw = await file.text();
      const normalized = normalizeSyllabusText(raw);

      if (!normalized) {
        setSyllabusText("");
        setUploadStatus("Could not extract readable text. Try a text/markdown syllabus.");
        return;
      }

      setSyllabusText(normalized);
      setSourceType("syllabus");
      setUploadStatus(
        `Loaded syllabus text (${normalized.length} chars). Generation will use this source.`,
      );
    } catch {
      setSyllabusText("");
      setUploadStatus("Failed to read file contents.");
    }
  };

  const handleSend = async () => {
    if (isRunning) {
      return;
    }

    const resolvedInput = resolveInput();
    if (!resolvedInput) {
      return;
    }

    const now = Date.now();
    const userText =
      resolvedInput.sourceType === "syllabus"
        ? `Use syllabus input: ${selectedFile?.name ?? "uploaded text"}`
        : resolvedInput.concept;

    setMessages((prev) => [
      ...prev,
      { id: `m-${now}`, role: "user", text: truncatePreview(userText) },
      {
        id: `m-${now}-a`,
        role: "assistant",
        text:
          resolvedInput.sourceType === "syllabus"
            ? "Running curriculum decomposition and multi-game generation from syllabus..."
            : "Running curriculum decomposition and multi-game generation from prompt...",
      },
    ]);

    if (resolvedInput.sourceType === "prompt") {
      setInput("");
    }

    const result = await runPipeline({ navigate: true });

    setMessages((prev) => [
      ...prev,
      {
        id: `m-${Date.now()}-done`,
        role: "assistant",
        text:
          result.games.length > 0
            ? `Created ${result.games.length} concept games. Opening interactive learning mode.`
            : "Pipeline finished without generated concept games. Check run logs.",
      },
    ]);
  };

  const handleRunSingleStep = async (step: PipelineStep) => {
    if (isRunning) {
      return;
    }

    const resolvedInput = resolveInput();
    if (!resolvedInput) {
      return;
    }

    const conceptNode = latestConcepts[0] ?? fallbackConceptNode(resolvedInput.concept);
    const prompt = step === "design" ? resolvedInput.concept : conceptPromptFromNode(conceptNode);
    const plan =
      step === "design"
        ? latestPlan
        : mergeDesignPlan(
            {
              ...(latestPlan ?? {}),
              title: conceptNode.title,
              concept: conceptNode.objective,
            },
            prompt,
          );

    await runStep(
      step,
      {
        prompt,
        fileName: selectedFile?.name ?? null,
        sourceType: resolvedInput.sourceType,
        syllabusText: syllabusText || null,
        plan,
        config: latestConfig,
        issues: latestIssues,
        conceptNode,
      },
      step === "design" ? "Curriculum" : conceptNode.title,
    );
  };

  return (
    <main className="page">
      <div className="shell">
        <header className="topbar">
          <div className="brand">
            <span className="brandDot" />
            <div>
              <p className="brandTitle">Autonomous Game Engineer</p>
              <p className="brandMeta">Multi-agent syllabus-to-games pipeline</p>
            </div>
          </div>
          <div className="topbarActions">
            <span className="statusPill">Concept Curriculum Mode</span>
            <button
              className="ghostButton"
              type="button"
              onClick={() => {
                setMessages(initialMessages);
                setLogs([]);
                setInput("");
                setSelectedFile(null);
                setSyllabusText("");
                setUploadStatus("No syllabus loaded yet.");
                setSourceType("prompt");
                setLatestPlan(null);
                setLatestConfig(null);
                setLatestIssues([]);
                setLatestConcepts([]);
                setGeneratedGames([]);
              }}
            >
              New Session
            </button>
          </div>
        </header>

        <section className="hero">
          <p className="eyebrow">Syllabus to concept games</p>
          <h1>Split input into concepts and generate one learning game per concept.</h1>
          <p className="lede">
            Design, build, visualization, playtest, and fix agents orchestrate LLM + physics
            tools, then produce interactive mini-games with equation annotations.
          </p>
        </section>

        <section className="grid">
          <div className="panel chatPanel">
            <div className="panelHeader">
              <div>
                <h2>Session</h2>
                <p>Choose source mode, then run the concept-to-games workflow.</p>
              </div>
              <div className="pill">Curriculum Builder</div>
            </div>

            <div className="sourceModeRow">
              <button
                className={`sourceModeButton ${sourceType === "prompt" ? "active" : ""}`}
                type="button"
                onClick={() => setSourceType("prompt")}
              >
                Prompt Source
              </button>
              <button
                className={`sourceModeButton ${sourceType === "syllabus" ? "active" : ""}`}
                type="button"
                onClick={() => setSourceType("syllabus")}
                disabled={!syllabusText}
              >
                Syllabus Source
              </button>
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
                      handleSend();
                    }
                  }}
                  disabled={sourceType === "syllabus"}
                />
                <button
                  className="sendButton"
                  type="button"
                  onClick={handleSend}
                  disabled={isRunning || !canRun}
                >
                  Generate Games
                </button>
              </div>
            </div>
          </div>

          <aside className="panel sidePanel">
            <div className="panelHeader">
              <div>
                <h2>Syllabus Upload</h2>
                <p>Upload syllabus text to drive concept extraction and game generation.</p>
              </div>
            </div>

            <div className="uploadCard">
              <div className="uploadZone">
                <input
                  className="fileInput"
                  id="syllabus-file"
                  type="file"
                  accept=".pdf,.md,.txt,.doc,.docx"
                  onChange={handleFileChange}
                />
                <label className="uploadButton" htmlFor="syllabus-file">
                  Upload Syllabus
                </label>
                <p className="uploadHint">
                  {selectedFile ? selectedFile.name : "PDF, Markdown, or text."}
                </p>
                <p className="uploadHint">{uploadStatus}</p>
              </div>
              <div className="uploadMeta">
                <p className="metaTitle">Workflow</p>
                <ul className="metaList">
                  <li>Design agent splits syllabus into concept tracks</li>
                  <li>Build agent generates one game config per concept</li>
                  <li>Visualization and playtest/fix agents tune each game</li>
                  <li>Game view includes tutor mode and equation annotations</li>
                </ul>
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
                    onClick={() => handleRunSingleStep(step)}
                    disabled={isRunning || !canRun}
                  >
                    {stepLabels[step]}
                  </button>
                ))}
              </div>
              <button
                className="primaryButton"
                type="button"
                onClick={() => runPipeline({ navigate: false })}
                disabled={isRunning || !canRun}
              >
                {isRunning ? "Running..." : "Run Full Curriculum Pipeline"}
              </button>
            </div>

            <div className="conceptSummary">
              <p className="metaTitle">Concept Breakdown</p>
              {latestConcepts.length === 0 ? (
                <p className="logEmpty">No concepts extracted yet.</p>
              ) : (
                <div className="conceptList">
                  {latestConcepts.map((conceptNode) => (
                    <div key={conceptNode.id} className="conceptItem">
                      <p className="conceptTitle">{conceptNode.title}</p>
                      <p className="conceptObjective">{conceptNode.objective}</p>
                      <span className="conceptMode">{conceptNode.suggestedMode}</span>
                    </div>
                  ))}
                </div>
              )}
              {generatedGames.length > 0 ? (
                <p className="generatedHint">
                  Generated {generatedGames.length} concept game
                  {generatedGames.length === 1 ? "" : "s"}.
                </p>
              ) : null}
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
          </aside>
        </section>
      </div>
    </main>
  );
}
