"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import styles from "./page.module.css";

type Provider = "openai" | "anthropic" | "google" | "meta";

type ModelOption = {
  id: string;
  label: string;
  provider: Provider;
  mode: "real" | "mock";
};

const MODEL_OPTIONS: ModelOption[] = [
  {
    id: "gpt-4.1-mini",
    label: "OpenAI - GPT-4.1 mini (real API call)",
    provider: "openai",
    mode: "real",
  },
  {
    id: "claude-3-5-sonnet-latest",
    label: "Anthropic - Claude 3.5 Sonnet (mock)",
    provider: "anthropic",
    mode: "mock",
  },
  {
    id: "gemini-2.0-flash",
    label: "Google - Gemini 2.0 Flash (mock)",
    provider: "google",
    mode: "mock",
  },
  {
    id: "llama-3.1-70b-instruct",
    label: "Meta - Llama 3.1 70B Instruct (mock)",
    provider: "meta",
    mode: "mock",
  },
];

export default function LlmSelectorPage() {
  const [modelId, setModelId] = useState(MODEL_OPTIONS[0].id);
  const [prompt, setPrompt] = useState("Give me three hackathon project ideas.");
  const [response, setResponse] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const selectedModel = useMemo(
    () => MODEL_OPTIONS.find((option) => option.id === modelId) ?? MODEL_OPTIONS[0],
    [modelId],
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setResponse("");
    setLoading(true);

    try {
      const apiResponse = await fetch("/api/llm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: selectedModel.provider,
          model: selectedModel.id,
          prompt,
        }),
      });

      const payload = await apiResponse.json();

      if (!apiResponse.ok) {
        throw new Error(payload.error ?? "Request failed.");
      }

      setResponse(payload.output ?? "No output returned.");
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Unknown error.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <main className={styles.card}>
        <div className={styles.header}>
          <h1>LLM Selector</h1>
          <p>
            Pick a model and run a prompt. OpenAI options make a live API call;
            other providers currently return mock responses.
          </p>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          <label className={styles.label}>
            Model
            <select
              className={styles.input}
              value={modelId}
              onChange={(event) => setModelId(event.target.value)}
            >
              {MODEL_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.label}>
            Prompt
            <textarea
              className={styles.textarea}
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              rows={6}
            />
          </label>

          <button className={styles.button} disabled={loading} type="submit">
            {loading ? "Running..." : "Run Prompt"}
          </button>
        </form>

        <div className={styles.meta}>
          <span>Provider: {selectedModel.provider}</span>
          <span>Mode: {selectedModel.mode}</span>
        </div>

        {error ? <p className={styles.error}>{error}</p> : null}
        {response ? (
          <section className={styles.output}>
            <h2>Response</h2>
            <pre>{response}</pre>
          </section>
        ) : null}

        <Link className={styles.backLink} href="/">
          Back to home
        </Link>
      </main>
    </div>
  );
}
