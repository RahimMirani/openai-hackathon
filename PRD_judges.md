# PRD for Judges
## Autonomous Game Engineer (Powered by Codex)

## 1. One-Line Product
An autonomous multi-agent Codex system that turns structured inputs into playable canvas games, detects gameplay failures, and ships fixes in real time.

## 2. Why This Matters
Game development usually requires separate roles and long iteration cycles. This project compresses design, implementation, testing, and debugging into a single autonomous loop visible during a live demo.

## 3. Demo Objective
Show that Codex can operate as a full-cycle game engineer:
1. Generate a playable game from a prompt or syllabus.
2. Detect a mechanical failure through autonomous playtesting.
3. Apply and validate a fix.
4. Return to a stable playable state.

## 4. What Judges Will See (Live Flow)
1. Input provided (game spec or syllabus file).
2. Design agent outputs mechanics + win/fail conditions.
3. Engineering agent builds executable canvas config.
4. Playtesting agent flags gameplay issue(s).
5. Debug/iteration agent applies fix.
6. Corrected game is replayed successfully.

## 5. Product Scope for Hackathon
### In Scope
1. Prompt-to-playable generation.
2. Optional syllabus-to-mechanics extraction.
3. Four-step autonomous pipeline: `design -> build -> playtest -> fix`.
4. Deterministic runtime with explicit `running/win/lose` states.
5. Run logs and structured status feedback.

### Out of Scope
1. High-fidelity graphics or cinematic UI.
2. Large content libraries or multi-game publishing platform.
3. Human-authored manual balancing during demo.

## 6. Core Innovation
1. Multi-agent role decomposition within one Codex-driven system.
2. End-to-end autonomous iteration, not just code generation.
3. Deterministic mechanics enabling reproducible failure/fix validation.
4. Transparent process observability via pipeline logs.

## 7. Technical Snapshot
1. Frontend: Next.js app with chat-first control surface and game runtime route.
2. Runtime: HTML5 canvas deterministic game loop.
3. APIs: `/api/design`, `/api/build`, `/api/playtest`, `/api/fix`, `/api/syllabus/extract`, `/api/ui-test`.
4. Data handoff: generated config persisted and loaded into runtime.

## 8. Success Criteria (Judge-Facing)
1. Time to first playable game is under 2 minutes.
2. Pipeline executes all 4 agent steps without manual code edits.
3. At least one gameplay fault is detected and repaired live.
4. Post-fix run reaches expected win/fail behavior consistently.
5. Process remains auditable through visible logs and outputs.

## 9. Evaluation Rubric Mapping
### Technical Difficulty
Parallel multi-agent orchestration, deterministic simulation, autonomous debugging loop.

### Execution Quality
Clear API contracts, modular pipeline stages, reproducible run behavior.

### Innovation
Treats Codex as an autonomous engineer operating across full SDLC phases.

### Practical Impact
Transferable pattern for simulations, prototyping systems, and automated QA loops.

## 10. Team Operating Model (4 People)
1. Design owner: mechanics and constraints.
2. Engineering owner: runtime and generation logic.
3. Playtesting owner: autonomous tests and failure reporting.
4. Iteration owner: fix loop and regression validation.

Each owner runs Codex in scoped branches/worktrees and merges on short cycles.

## 11. Known Risks and Controls
1. Stubbed logic risk.
Control: prioritize depth in build/playtest/fix agents first.
2. Nondeterministic behavior risk.
Control: deterministic state transitions and constrained randomness.
3. Merge conflict risk during hackathon.
Control: strict ownership boundaries and frequent small PRs.

## 12. Final Deliverable
A fully demonstrable autonomous system where Codex:
1. translates abstract inputs into game mechanics,
2. builds a playable game,
3. identifies mechanical failures,
4. iterates to a corrected version,
5. and proves stability through replay.
