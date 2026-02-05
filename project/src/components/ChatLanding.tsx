"use client";

import type { ChangeEvent } from "react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type PipelineStep = "design" | "build" | "playtest" | "fix";

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

const orderedSteps: PipelineStep[] = [
  "design",
  "build",
  "playtest",
  "fix",
];

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

export default function ChatLanding() {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [logs, setLogs] = useState<RunLog[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);

  const placeholderHint = useMemo(() => {
    if (selectedFile) {
      return `Attached: ${selectedFile.name}`;
    }
    return "Describe the game you want to generate...";
  }, [selectedFile]);

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
      plan?: {};
      issues?: string[];
    }
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

      const data = (await response.json()) as { message?: string; config?: {} };
      appendLog({
        step,
        status: "ok",
        message: data.message ?? `${stepLabels[step]} complete.`,
      });
      return data;
    } catch (error) {
      appendLog({
        step,
        status: "error",
        message: `${stepLabels[step]} failed. Try again.`,
      });
      return null;
    }
  };

  const runPipeline = async (options?: {
    navigate?: boolean;
    promptOverride?: string;
  }) => {
    if (isRunning) {
      return;
    }
    const prompt = options?.promptOverride ?? input.trim();
    const basePayload = { prompt, fileName: selectedFile?.name ?? null };
    setIsRunning(true);
    let plan: {} | null = null;
    let issues: string[] = [];
    let gameConfig: {} | null = null;
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
        plan = (data as { plan?: {} }).plan ?? null;
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

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
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
            Describe mechanics, constraints, and win conditions, or upload a
            syllabus to derive the game structure.
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
                      handleSend();
                    }
                  }}
                />
                <button
                  className="sendButton"
                  type="button"
                  onClick={handleSend}
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
                  onChange={handleFileChange}
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
                      runStep(step, {
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
                onClick={() => runPipeline({ navigate: false })}
                disabled={isRunning}
              >
                {isRunning ? "Running..." : "Run Pipeline"}
              </button>
            </div>

            <div className="runLog">
              <p className="metaTitle">Run Log</p>
              <div className="logList">
                {logs.length === 0 ? (
                  <p className="logEmpty">
                    No runs yet. Trigger a step to see activity.
                  </p>
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
