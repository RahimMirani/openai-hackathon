# Product Requirements Document (PRD)
## Autonomous Game Engineer (Powered by Codex)

## 1. Product Summary
Autonomous Game Engineer is a Codex-powered system that converts structured inputs into playable HTML5 canvas games, then iteratively improves those games via autonomous playtesting and debugging loops. The product emphasizes deterministic mechanics, clear win/fail states, and visible engineering process over visual polish.

## 2. Problem Statement
Current game prototyping workflows are slow and fragmented across design, implementation, testing, and debugging. This project demonstrates a unified agent-driven workflow where Codex performs the full software lifecycle with minimal manual orchestration.

## 3. Goals
1. Accept game specs or syllabus documents as input.
2. Convert input into concrete mechanics and system constraints.
3. Generate a playable game build in a deterministic runtime.
4. Run autonomous playtests and produce structured failure reports.
5. Apply iterative fixes and validate regressions.
6. Showcase the end-to-end loop live in a hackathon demo.

## 4. Non-Goals
1. High-fidelity art, advanced animation, or cinematic UX polish.
2. Open-ended sandbox authoring tools for external users.
3. Multi-platform export beyond web demo scope.
4. Instructional content generation from syllabus text.

## 5. Target Users
1. Hackathon judges and technical audience evaluating autonomy.
2. Builders experimenting with agentic software development.
3. Educator-adjacent prototype users validating syllabus-to-mechanics mapping.

## 6. User Stories
1. As a user, I can enter a concise game prompt and generate a playable game.
2. As a user, I can upload a syllabus file and receive mechanic-aligned game options.
3. As a user, I can run the Design/Build/Playtest/Fix pipeline and inspect logs.
4. As a user, I can launch the generated game and verify win/fail conditions.
5. As a developer, I can reproduce failures and track fixes across iterations.

## 7. Functional Requirements
### 7.1 Input Layer
1. System must accept text prompt input for game generation.
2. System must accept syllabus upload (`.pdf`, `.md`, `.txt`, `.doc`, `.docx`).
3. System must extract core concepts and map them to demo options.

### 7.2 Agent Pipeline
1. Design step returns mechanics, rules, win/fail structure.
2. Build step returns concrete runtime config (player, obstacles, arena, rules).
3. Playtest step returns issue list with deterministic criteria.
4. Fix step accepts issue list and returns patch status.
5. Pipeline must support full-run execution and per-step execution.

### 7.3 Runtime and Rendering
1. Generated config must run in HTML5 canvas runtime.
2. Runtime must support deterministic update loop and collision handling.
3. Runtime must expose explicit status: `running`, `win`, `lose`.
4. Config persistence between generation and play page must be supported.

### 7.4 Observability
1. UI must log pipeline step status (`running`, `ok`, `error`).
2. UI must show extraction result summary, key concepts, and options.
3. System must provide timestamped responses for each pipeline step.

### 7.5 Demo Control
1. User can run full pipeline from chat prompt.
2. User can run syllabus extraction + derived generation.
3. User can intentionally trigger failure scenario and rerun fix cycle.

## 8. Non-Functional Requirements
1. Determinism: Same config + input sequence should produce reproducible behavior.
2. Performance: Game loop must remain stable at interactive framerate on modern laptop.
3. Reliability: API errors must return structured responses and user-facing status.
4. Modularity: Agent steps are separable endpoints for independent evolution.
5. Traceability: Pipeline actions must be auditable via run logs and git history.

## 9. Current Implementation Baseline
1. Frontend is implemented in Next.js App Router.
2. Chat-first landing UI exists with pipeline controls and syllabus upload.
3. Canvas runtime exists with dodge-style deterministic prototype loop.
4. API routes exist for `design`, `build`, `playtest`, `fix`, `syllabus/extract`, and `ui-test`.
5. Pipeline currently contains scaffold logic and should be extended with deeper agent behavior.

## 10. MVP Scope (Hackathon)
1. Prompt-to-playable loop works end to end without manual code edits.
2. Syllabus upload produces at least three relevant playable option prompts.
3. One deterministic game mode is fully stable and demo-ready.
4. At least one reproducible failure and one verified fix cycle are shown live.
5. UI test agent can run against key routes and produce structured findings.

## 11. Future Scope (Post-MVP)
1. Multi-template game generation (puzzle, resource, turn-based).
2. Automated balancing loops using telemetry-based heuristics.
3. Persistent session history and artifact snapshots.
4. Multi-agent orchestration dashboard and comparative run analytics.

## 12. Success Metrics
1. Time-to-first-playable: under 2 minutes from prompt submission.
2. Pipeline completion rate: 90%+ successful step completion in demo environment.
3. Regression pass rate: 95%+ on predefined smoke scenarios after fix step.
4. Demo reliability: complete 5-step live demo flow without manual fallback.

## 13. Technical Architecture
### 13.1 Frontend
1. `/` and `/chat`: chat-first interface and pipeline controls.
2. `/game`: canvas runtime rendering generated config.

### 13.2 Backend API
1. `POST /api/design`: generate mechanic plan from prompt.
2. `POST /api/build`: transform plan into executable game config.
3. `POST /api/playtest`: simulate/validate and return issue list.
4. `POST /api/fix`: apply issue-informed corrections and report status.
5. `POST /api/syllabus/extract`: derive concept map and game options from upload.
6. `POST /api/ui-test`: run accessibility/UX smoke checks across routes.

### 13.3 Shared Data Contracts
1. Pipeline payload includes: `prompt`, `fileName`, optional `plan`, optional `issues`.
2. Build returns `config` object consumed by game runtime.
3. Config persisted in browser storage key: `age.gameConfig`.

## 14. Team Execution Plan (4 People Using Codex App)
1. Design Owner: finalize mechanic schema, constraints, and acceptance criteria.
2. Engineering Owner: implement runtime/game systems and config compatibility.
3. Playtest Owner: implement autonomous scenarios and failure detectors.
4. Iteration Owner: triage findings, patch quickly, run regression checks.

### 14.1 Operating Model
1. One branch/worktree per owner (`codex/design-*`, `codex/engine-*`, `codex/playtest-*`, `codex/fix-*`).
2. Shared contracts live in docs and typed interfaces before parallel coding.
3. Merge cadence every 60-90 minutes with short integration gate.

### 14.2 Definition of Done (Hackathon)
1. Full pipeline executes from UI for prompt and syllabus paths.
2. Game is playable with deterministic win/fail behavior.
3. Failure reproduction and fix verification are recorded in logs.
4. Final demo script can be run start-to-finish in one session.

## 15. Risks and Mitigations
1. Risk: Pipeline remains shallow stubs.
Mitigation: Prioritize realistic logic in `build`, `playtest`, and `fix` before UI polish.
2. Risk: Non-deterministic behavior breaks reproducibility.
Mitigation: Seed randomization and isolate deterministic simulation rules.
3. Risk: Team merge conflicts during hackathon.
Mitigation: Strict file ownership and frequent small PRs.
4. Risk: Syllabus parsing quality varies for PDFs.
Mitigation: Fallback parsing + clear error messaging + test corpus.

## 16. Milestones and Timeline
1. M1 (Setup): contracts, branch strategy, baseline flow validated.
2. M2 (Core): robust design->build->playtest->fix logic with one stable game loop.
3. M3 (Validation): automated test scenarios, UI checks, deterministic replay.
4. M4 (Demo): scripted live flow with known failure and verified fix.

## 17. Open Questions
1. Should fix step mutate configs only or patch source modules directly?
2. What minimum deterministic replay interface is required for judging?
3. Should syllabus mode always require user option selection before build?
4. What exact scoring model determines playtest pass/fail severity?

## 18. Acceptance Criteria
1. A user can provide a prompt and play a generated game from the same session.
2. A user can upload a syllabus and generate a concept-aligned playable output.
3. System returns visible step-by-step logs for all four agent stages.
4. At least one induced bug is detected and resolved through fix iteration.
5. Demo concludes with a stable playable state after correction.
