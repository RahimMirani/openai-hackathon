"use client";

import type { ChangeEvent } from "react";
import { useMemo, useState, useCallback } from "react";
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
type PipelinePhase = "idle" | "running" | "complete" | "error";

type StepStatus = "pending" | "running" | "complete" | "error" | "skipped";

type StepState = {
  status: StepStatus;
  message: string;
  duration?: number;
  tools?: string[];
};

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
  gameSpec?: unknown; // Dynamic game specification
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
  gameSpec?: unknown; // Dynamic game specification
  issues: string[];
};

const STORAGE_CONFIG = "age.gameConfig";
const STORAGE_CONFIGS = "age.gameConfigs";
const STORAGE_GAME_SPEC = "age.gameSpec";
const STORAGE_DYNAMIC_GAMES = "age.dynamicGames";

const stepLabels: Record<PipelineStep, string> = {
  design: "Design",
  build: "Build",
  visualize: "Visualize",
  playtest: "Playtest",
  fix: "Fix",
};

const stepDescriptions: Record<PipelineStep, string> = {
  design: "Analyzing input and extracting learning concepts",
  build: "Generating physics simulation and game config",
  visualize: "Tuning visual style and color palette",
  playtest: "Running automated physics validation",
  fix: "Applying calibration fixes from playtest",
};

const stepIcons: Record<PipelineStep, string> = {
  design: "🎯",
  build: "⚙️",
  visualize: "🎨",
  playtest: "🧪",
  fix: "🔧",
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
    text: "Enter a physics concept, topic, or upload a syllabus. I'll generate interactive learning games with real-time simulations.",
  },
  {
    id: "m2",
    role: "assistant",
    text: "Try: \"gravity and free fall\", \"momentum and collisions\", or upload a course syllabus for multi-concept games.",
  },
];

const initialStepStates: Record<PipelineStep, StepState> = {
  design: { status: "pending", message: "" },
  build: { status: "pending", message: "" },
  visualize: { status: "pending", message: "" },
  playtest: { status: "pending", message: "" },
  fix: { status: "pending", message: "" },
};

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
  const [pipelinePhase, setPipelinePhase] = useState<PipelinePhase>("idle");
  const [stepStates, setStepStates] = useState<Record<PipelineStep, StepState>>(initialStepStates);
  const [currentStep, setCurrentStep] = useState<PipelineStep | null>(null);
  const [processingConcept, setProcessingConcept] = useState<string | null>(null);
  const [totalDuration, setTotalDuration] = useState<number>(0);

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

  const updateStepState = useCallback((step: PipelineStep, update: Partial<StepState>) => {
    setStepStates((prev) => ({
      ...prev,
      [step]: { ...prev[step], ...update },
    }));
  }, []);

  const runStep = async (
    step: PipelineStep,
    payload: StepPayload,
    contextLabel?: string,
  ): Promise<StepResponse | null> => {
    const startTime = Date.now();
    setCurrentStep(step);
    updateStepState(step, { status: "running", message: stepDescriptions[step] });

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

      const duration = Date.now() - startTime;
      const toolsSummary =
        Array.isArray(data.agent?.tools) && data.agent?.tools.length > 0
          ? ` [tools: ${data.agent.tools.join(", ")}]`
          : "";

      updateStepState(step, {
        status: "complete",
        message: data.message ?? `${stepLabels[step]} complete`,
        duration,
        tools: data.agent?.tools,
      });

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
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      updateStepState(step, {
        status: "error",
        message: `Failed: ${errorMessage}`,
        duration,
      });

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

    const pipelineStart = Date.now();
    setIsRunning(true);
    setPipelinePhase("running");
    setStepStates(initialStepStates);
    setProcessingConcept(null);
    setTotalDuration(0);

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

    for (let conceptIndex = 0; conceptIndex < resolvedConcepts.length; conceptIndex++) {
      const conceptNode = resolvedConcepts[conceptIndex];
      const conceptLabel = conceptNode.title;
      const conceptPrompt = conceptPromptFromNode(conceptNode);
      setProcessingConcept(`${conceptIndex + 1}/${resolvedConcepts.length}: ${conceptLabel}`);

      const conceptPlan = mergeDesignPlan(
        {
          ...(plan ?? {}),
          title: conceptNode.title,
          concept: conceptNode.objective,
        },
        conceptPrompt,
      );

      let config: GameConfig | null = null;
      let gameSpec: unknown = null;
      let issues: string[] = [];
      let conceptComplete = true;

      // Reset step states for each concept (except design which is done once)
      setStepStates((prev) => ({
        ...prev,
        build: { status: "pending", message: "" },
        visualize: { status: "pending", message: "" },
        playtest: { status: "pending", message: "" },
        fix: { status: "pending", message: "" },
      }));

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

        // Capture dynamic game spec from build step
        if (step === "build" && data.gameSpec) {
          gameSpec = data.gameSpec;
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
          gameSpec,
          issues,
        });
      }
    }

    const pipelineDuration = Date.now() - pipelineStart;
    setTotalDuration(pipelineDuration);
    setLatestPlan(plan);
    setLatestConfig(builtGames[0]?.config ?? latestConfig);
    setLatestIssues(builtGames[0]?.issues ?? []);
    setGeneratedGames(builtGames);
    setIsRunning(false);
    setCurrentStep(null);
    setProcessingConcept(null);
    setPipelinePhase(completed && builtGames.length > 0 ? "complete" : "error");

    if (options?.navigate && builtGames.length > 0) {
      localStorage.setItem(STORAGE_CONFIG, JSON.stringify(builtGames[0].config));
      localStorage.setItem(STORAGE_CONFIGS, JSON.stringify(builtGames));
      // Store dynamic game specs for the new engine
      if (builtGames[0].gameSpec) {
        localStorage.setItem(STORAGE_GAME_SPEC, JSON.stringify(builtGames[0].gameSpec));
        localStorage.setItem(STORAGE_DYNAMIC_GAMES, JSON.stringify(builtGames.map(g => ({ gameSpec: g.gameSpec, conceptNode: g.conceptNode }))));
      }
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
                setPipelinePhase("idle");
                setStepStates(initialStepStates);
                setCurrentStep(null);
                setProcessingConcept(null);
                setTotalDuration(0);
              }}
            >
              New Session
            </button>
          </div>
        </header>

        <section className="hero">
          <p className="eyebrow">AI-Powered Learning Game Generator</p>
          <h1>Transform any concept into an interactive physics game.</h1>
          <p className="lede">
            Enter a topic or upload a syllabus. Our multi-agent system will analyze, design, build, and validate
            educational games with real-time simulations and equation annotations.
          </p>
        </section>

        {/* Pipeline Stepper */}
        {pipelinePhase !== "idle" && (
          <section className="pipelineStepper">
            <div className="stepperHeader">
              <div className="stepperTitle">
                <span className="stepperIcon">{pipelinePhase === "running" ? "⚡" : pipelinePhase === "complete" ? "✅" : "❌"}</span>
                <div>
                  <h3>
                    {pipelinePhase === "running"
                      ? "Generating Games..."
                      : pipelinePhase === "complete"
                        ? `Generated ${generatedGames.length} Game${generatedGames.length !== 1 ? "s" : ""}`
                        : "Generation Failed"}
                  </h3>
                  {processingConcept && pipelinePhase === "running" && (
                    <p className="stepperSubtitle">Processing: {processingConcept}</p>
                  )}
                  {pipelinePhase === "complete" && totalDuration > 0 && (
                    <p className="stepperSubtitle">Completed in {(totalDuration / 1000).toFixed(1)}s</p>
                  )}
                </div>
              </div>
              {pipelinePhase === "complete" && generatedGames.length > 0 && (
                <button
                  className="primaryButton playButton"
                  type="button"
                  onClick={() => {
                    localStorage.setItem(STORAGE_CONFIG, JSON.stringify(generatedGames[0].config));
                    localStorage.setItem(STORAGE_CONFIGS, JSON.stringify(generatedGames));
                    if (generatedGames[0].gameSpec) {
                      localStorage.setItem(STORAGE_GAME_SPEC, JSON.stringify(generatedGames[0].gameSpec));
                      localStorage.setItem(STORAGE_DYNAMIC_GAMES, JSON.stringify(generatedGames.map(g => ({ gameSpec: g.gameSpec, conceptNode: g.conceptNode }))));
                    }
                    router.push("/game");
                  }}
                >
                  🎮 Play Games
                </button>
              )}
            </div>

            <div className="stepperTrack">
              {orderedSteps.map((step, index) => {
                const state = stepStates[step];
                const isActive = currentStep === step;
                const statusClass =
                  state.status === "complete"
                    ? "complete"
                    : state.status === "running"
                      ? "running"
                      : state.status === "error"
                        ? "error"
                        : "pending";

                return (
                  <div key={step} className={`stepperStep ${statusClass} ${isActive ? "active" : ""}`}>
                    <div className="stepperStepIcon">
                      {state.status === "complete" ? (
                        "✓"
                      ) : state.status === "running" ? (
                        <span className="stepperSpinner" />
                      ) : state.status === "error" ? (
                        "✗"
                      ) : (
                        index + 1
                      )}
                    </div>
                    <div className="stepperStepContent">
                      <span className="stepperStepLabel">
                        {stepIcons[step]} {stepLabels[step]}
                      </span>
                      {state.message && (
                        <span className="stepperStepMessage">{state.message}</span>
                      )}
                      {state.tools && state.tools.length > 0 && (
                        <span className="stepperStepTools">
                          Tools: {state.tools.join(", ")}
                        </span>
                      )}
                    </div>
                    {state.duration !== undefined && state.status === "complete" && (
                      <span className="stepperStepDuration">{(state.duration / 1000).toFixed(1)}s</span>
                    )}
                    {index < orderedSteps.length - 1 && <div className="stepperConnector" />}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Agent Summary - shown after completion */}
        {pipelinePhase === "complete" && generatedGames.length > 0 && (
          <section className="agentSummary">
            <div className="summaryHeader">
              <h3>🤖 What the Agents Did</h3>
              <p>Here's how each agent contributed to your games:</p>
            </div>
            <div className="summaryGrid">
              <div className="summaryCard">
                <div className="summaryCardIcon">🎯</div>
                <div className="summaryCardContent">
                  <h4>Design Agent</h4>
                  <p>Analyzed your input and identified <strong>{latestConcepts.length}</strong> distinct learning concepts.</p>
                  {latestPlan && (
                    <ul className="summaryDetails">
                      <li>Mechanics: {latestPlan.mechanics.slice(0, 3).join(", ")}</li>
                      <li>Difficulty: {latestPlan.difficulty}/10</li>
                    </ul>
                  )}
                </div>
              </div>
              <div className="summaryCard">
                <div className="summaryCardIcon">⚙️</div>
                <div className="summaryCardContent">
                  <h4>Build Agent</h4>
                  <p>Generated <strong>{generatedGames.length}</strong> physics simulation{generatedGames.length !== 1 ? "s" : ""} with interactive controls.</p>
                  <ul className="summaryDetails">
                    <li>Modes: {[...new Set(generatedGames.map(g => g.config.demonstration.mode))].join(", ")}</li>
                    <li>Equations: {generatedGames.reduce((acc, g) => acc + g.config.learning.equationAnnotations.length, 0)} annotations</li>
                  </ul>
                </div>
              </div>
              <div className="summaryCard">
                <div className="summaryCardIcon">🎨</div>
                <div className="summaryCardContent">
                  <h4>Visualize Agent</h4>
                  <p>Applied themed color palettes and styled each game canvas.</p>
                  <ul className="summaryDetails">
                    <li>Trails: {generatedGames.some(g => g.config.visualization.showTrails) ? "Enabled" : "Disabled"}</li>
                    <li>Grid: {generatedGames.some(g => g.config.visualization.showGrid) ? "Visible" : "Hidden"}</li>
                  </ul>
                </div>
              </div>
              <div className="summaryCard">
                <div className="summaryCardIcon">🧪</div>
                <div className="summaryCardContent">
                  <h4>Playtest Agent</h4>
                  <p>Ran automated physics validation on all generated games.</p>
                  <ul className="summaryDetails">
                    <li>Tests: {generatedGames.length} simulations validated</li>
                    <li>Issues: {generatedGames.reduce((acc, g) => acc + g.issues.length, 0)} fixes applied</li>
                  </ul>
                </div>
              </div>
            </div>
            <div className="summaryActions">
              <button
                className="primaryButton"
                type="button"
                onClick={() => {
                  localStorage.setItem(STORAGE_CONFIG, JSON.stringify(generatedGames[0].config));
                  localStorage.setItem(STORAGE_CONFIGS, JSON.stringify(generatedGames));
                  if (generatedGames[0].gameSpec) {
                    localStorage.setItem(STORAGE_GAME_SPEC, JSON.stringify(generatedGames[0].gameSpec));
                    localStorage.setItem(STORAGE_DYNAMIC_GAMES, JSON.stringify(generatedGames.map(g => ({ gameSpec: g.gameSpec, conceptNode: g.conceptNode }))));
                  }
                  router.push("/game");
                }}
              >
                🎮 Start Playing Now
              </button>
              <p className="summaryHint">
                {generatedGames.length} interactive game{generatedGames.length !== 1 ? "s" : ""} ready with real-time physics and learning checkpoints.
              </p>
            </div>
          </section>
        )}

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
              <div className="conceptSummaryHeader">
                <p className="metaTitle">Extracted Concepts</p>
                {latestConcepts.length > 0 && (
                  <span className="conceptCount">{latestConcepts.length} found</span>
                )}
              </div>
              {latestConcepts.length === 0 ? (
                <div className="conceptEmpty">
                  <span className="conceptEmptyIcon">📚</span>
                  <p>Concepts will appear here after the Design agent analyzes your input.</p>
                </div>
              ) : (
                <div className="conceptList">
                  {latestConcepts.map((conceptNode, index) => {
                    const gameGenerated = generatedGames.some(
                      (g) => g.conceptNode.id === conceptNode.id
                    );
                    return (
                      <div
                        key={conceptNode.id}
                        className={`conceptItem ${gameGenerated ? "generated" : ""}`}
                      >
                        <div className="conceptItemHeader">
                          <span className="conceptNumber">{index + 1}</span>
                          <p className="conceptTitle">{conceptNode.title}</p>
                          {gameGenerated && <span className="conceptCheck">✓</span>}
                        </div>
                        <p className="conceptObjective">{conceptNode.objective}</p>
                        <div className="conceptMeta">
                          <span className="conceptMode">{conceptNode.suggestedMode}</span>
                          {gameGenerated && (
                            <span className="conceptGameReady">Game Ready</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="runLog">
              <div className="runLogHeader">
                <p className="metaTitle">Activity Log</p>
                {logs.length > 0 && (
                  <button
                    className="logClearButton"
                    type="button"
                    onClick={() => setLogs([])}
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="logList">
                {logs.length === 0 ? (
                  <div className="logEmpty">
                    <span className="logEmptyIcon">📋</span>
                    <p>Agent activity will appear here as they run.</p>
                  </div>
                ) : (
                  logs.slice(0, 15).map((log) => (
                    <div key={log.id} className={`logItem ${log.status}`}>
                      <div className="logItemIcon">
                        {stepIcons[log.step]}
                      </div>
                      <div className="logItemContent">
                        <p className="logTitle">
                          {stepLabels[log.step]}
                          {log.status === "running" && <span className="logRunningDot" />}
                        </p>
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
